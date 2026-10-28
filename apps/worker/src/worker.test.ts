// Integration tests for the queue and the scan job against a migrated
// database. Skipped without DATABASE_URL, like the db package's tests.
//
// Other test files share the database and may briefly queue jobs of their
// own, so test jobs are due long ago (claims take the oldest first) and the
// tests never assert that the queue is empty.
import type { A11yIssue } from '@curbcut/core';
import { createDb, issues, jobs, scans, type Db } from '@curbcut/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnsafeUrlError } from './errors';
import { scanJob } from './jobs/scan';
import { createQueue, LostJobError, type Job, type Queue } from './queue';
import { createWorker } from './worker';

describe.skipIf(!process.env.DATABASE_URL)('worker', () => {
  let db: Db;
  let queue: Queue;
  let other: Queue;
  const jobIds: string[] = [];
  const scanIds: string[] = [];

  beforeAll(() => {
    db = createDb();
    queue = createQueue(db, { workerId: 'test-a', backoffMs: 60_000 });
    other = createQueue(db, { workerId: 'test-b', backoffMs: 60_000 });
  });

  afterAll(async () => {
    if (!db) return;
    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    if (scanIds.length) await db.delete(scans).where(inArray(scans.id, scanIds));
    await db.$client.end();
  });

  async function newJob(values: Partial<typeof jobs.$inferInsert> = {}) {
    const [job] = await db
      .insert(jobs)
      .values({ type: 'scan', payload: {}, runAt: new Date('2000-01-01'), ...values })
      .returning();
    jobIds.push(job!.id);
    return job!;
  }

  /** Test jobs are the oldest due, so the next claim gets this one. */
  async function claim(q: Queue, id: string): Promise<Job> {
    const job = await q.claim();
    expect(job?.id).toBe(id);
    return job!;
  }

  async function reload(id: string) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job!;
  }

  /** Makes a requeued job due again without waiting out its backoff. */
  const makeDue = (id: string) =>
    db
      .update(jobs)
      .set({ runAt: new Date('2000-01-01') })
      .where(eq(jobs.id, id));

  describe('queue', () => {
    it('never gives the same job to two workers', async () => {
      const a = await newJob();
      const b = await newJob();
      const [x, y] = await Promise.all([queue.claim(), other.claim()]);
      expect(new Set([x?.id, y?.id])).toEqual(new Set([a.id, b.id]));
      expect(x).toMatchObject({ status: 'running', attempts: 1, lockedBy: 'test-a' });
      expect(y).toMatchObject({ status: 'running', attempts: 1, lockedBy: 'test-b' });
      expect(x!.lockedAt).toBeInstanceOf(Date);
      await queue.complete(x!);
      await other.complete(y!);
    });

    it('retries a failed attempt with backoff, up to max_attempts', async () => {
      const { id } = await newJob();

      let job = await claim(queue, id);
      expect(await queue.fail(job, 'boom')).toBe('queued');
      const first = await reload(id);
      expect(first).toMatchObject({ status: 'queued', attempts: 1, error: 'boom', lockedBy: null });
      // 60 s backoff for the second attempt, 120 s for the third.
      const delay = (j: Job) => (j.runAt.getTime() - Date.now()) / 1000;
      expect(delay(first)).toBeGreaterThan(50);
      expect(delay(first)).toBeLessThan(70);

      await makeDue(id);
      job = await claim(queue, id);
      expect(await queue.fail(job, 'boom')).toBe('queued');
      const second = await reload(id);
      expect(delay(second)).toBeGreaterThan(110);

      await makeDue(id);
      job = await claim(queue, id);
      expect(job.attempts).toBe(3);
      expect(await queue.fail(job, 'boom')).toBe('failed');
      expect(await reload(id)).toMatchObject({ status: 'failed', attempts: 3 });
    });

    it('fails a permanent error on the first attempt', async () => {
      const { id } = await newJob();
      const job = await claim(queue, id);
      expect(await queue.fail(job, 'bad payload', { permanent: true })).toBe('failed');
      expect(await reload(id)).toMatchObject({ status: 'failed', attempts: 1 });
    });

    it('requeues a job whose lock went stale, and fails it once out of attempts', async () => {
      const { id } = await newJob();
      const job = await claim(queue, id);
      const stale = sql`now() - interval '10 minutes'`;
      await db.update(jobs).set({ lockedAt: stale }).where(eq(jobs.id, id));

      expect(await queue.heartbeat(job)).toBe(true);
      expect(await queue.requeueStale(60_000)).toEqual([]);
      expect((await reload(id)).status).toBe('running');

      await db.update(jobs).set({ lockedAt: stale }).where(eq(jobs.id, id));
      await queue.requeueStale(60_000);
      expect(await reload(id)).toMatchObject({ status: 'queued', attempts: 1, lockedAt: null });

      // The original worker lost its lock and can no longer touch the job.
      expect(await queue.heartbeat(job)).toBe(false);
      await expect(queue.complete(job)).rejects.toThrow(LostJobError);
      expect(await queue.fail(job, 'late')).toBeUndefined();

      await db
        .update(jobs)
        .set({ status: 'running', attempts: 3, lockedAt: stale })
        .where(eq(jobs.id, id));
      const failed = await queue.requeueStale(60_000);
      expect(failed.map((j) => j.id)).toContain(id);
      expect(await reload(id)).toMatchObject({ status: 'failed' });
    });

    it('rolls back the result writes and the success if committing fails', async () => {
      const { id } = await newJob();
      const job = await claim(queue, id);
      await expect(
        queue.complete(job, async (tx) => {
          await tx.update(jobs).set({ error: 'written' }).where(eq(jobs.id, id));
          throw new Error('commit failed');
        }),
      ).rejects.toThrow('commit failed');
      expect(await reload(id)).toMatchObject({ status: 'running', error: null });
    });
  });

  describe('scan job', () => {
    const issue = (ruleId: string, fingerprint: string): A11yIssue => ({
      ruleId,
      impact: 'critical',
      help: 'Help',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/x',
      wcag: ['1.1.1'],
      pageUrl: 'https://example.com/',
      selector: 'img',
      html: '<img>',
      fingerprint,
    });

    async function newScanJob() {
      const [scan] = await db
        .insert(scans)
        .values({
          targets: ['https://example.com/'],
          createdByGithubId: 1,
          createdByLogin: 'test',
        })
        .returning();
      scanIds.push(scan!.id);
      const job = await newJob({ payload: { scanId: scan!.id } });
      return { scanId: scan!.id, jobId: job.id };
    }

    /** One tick runs the test's job, the oldest due. */
    async function runOnce(worker: ReturnType<typeof createWorker>, jobId: string) {
      expect(await worker.tick()).toBe(true);
      return reload(jobId);
    }

    const workerWith = (scan: () => Promise<{ issues: A11yIssue[]; axeVersion: string }>) =>
      createWorker({
        queue,
        handlers: { scan: scanJob(db, { scan }) },
        // Long enough that this test never requeues another test's running jobs.
        lockTimeoutMs: 86_400_000,
        log: () => undefined,
      });

    it('stores the issues and completes the scan', async () => {
      const { scanId, jobId } = await newScanJob();
      const worker = workerWith(() =>
        Promise.resolve({
          issues: [issue('image-alt', 'fp-1'), issue('button-name', 'fp-2')],
          axeVersion: '4.11.0',
        }),
      );
      expect(await runOnce(worker, jobId)).toMatchObject({ status: 'succeeded' });

      const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
      expect(scan).toMatchObject({ status: 'completed', axeVersion: '4.11.0', error: null });
      expect(scan!.startedAt).toBeInstanceOf(Date);
      expect(scan!.finishedAt).toBeInstanceOf(Date);
      const stored = await db.select().from(issues).where(eq(issues.scanId, scanId));
      expect(stored.map((i) => [i.ruleId, i.groupKey]).sort()).toEqual([
        ['button-name', 'button-name'],
        ['image-alt', 'image-alt'],
      ]);
    });

    it('fails the scan at once when the URL is unsafe', async () => {
      const { scanId, jobId } = await newScanJob();
      const worker = workerWith(() => Promise.reject(new UnsafeUrlError('private address')));
      expect(await runOnce(worker, jobId)).toMatchObject({
        status: 'failed',
        attempts: 1,
      });
      const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
      expect(scan).toMatchObject({ status: 'failed', error: 'private address' });
    });

    it('retries a transient failure, leaving the scan running', async () => {
      const { scanId, jobId } = await newScanJob();
      const worker = workerWith(() => Promise.reject(new Error('net::ERR_CONNECTION_RESET')));
      expect(await runOnce(worker, jobId)).toMatchObject({
        status: 'queued',
        attempts: 1,
      });
      const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
      expect(scan!.status).toBe('running');
    });

    it('fails a job with a bad payload without retrying', async () => {
      const { id } = await newJob({ payload: { scanId: 'not-a-uuid' } });
      const worker = workerWith(() => Promise.reject(new Error('should not scan')));
      expect(await runOnce(worker, id)).toMatchObject({ status: 'failed', attempts: 1 });
    });
  });
});
