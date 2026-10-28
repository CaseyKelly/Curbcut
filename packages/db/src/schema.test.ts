// Integration tests against a migrated database. Skipped without DATABASE_URL;
// CI provides a throwaway Postgres and runs `npm run db:migrate` first.
import { AgentStep } from '@curbcut/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  agentRuns,
  agentSteps,
  createDb,
  type Db,
  explanations,
  issues,
  jobs,
  scans,
} from './index';

describe.skipIf(!process.env.DATABASE_URL)('schema', () => {
  // Connect in beforeAll: the describe body still runs when the suite is skipped.
  let db: Db;
  const createdScans: string[] = [];

  beforeAll(() => {
    db = createDb();
  });

  afterAll(async () => {
    // Issues, runs, and steps cascade.
    for (const id of createdScans) await db.delete(scans).where(eq(scans.id, id));
    await db.$client.end();
  });

  async function newScan(targets = ['https://example.com/']) {
    const [scan] = await db.insert(scans).values({ targets, createdBy: 'test' }).returning();
    createdScans.push(scan!.id);
    return scan!;
  }

  /** The Postgres error behind a failed query (drizzle wraps it in `cause`). */
  async function pgError(query: Promise<unknown>) {
    const err: unknown = await query.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Error);
    return ((err as Error).cause ?? err) as { code?: string; constraint_name?: string };
  }

  it('stores scan targets as an array, with no auth profile by default', async () => {
    const scan = await newScan(['https://example.com/', 'https://example.com/about']);
    expect(scan.targets).toEqual(['https://example.com/', 'https://example.com/about']);
    expect(scan.authProfileId).toBeNull();
    expect(scan.status).toBe('queued');
    expect(scan.costUsd).toBe(0);
  });

  it('rejects a scan with no targets', async () => {
    const err = await pgError(db.insert(scans).values({ targets: [], createdBy: 'test' }));
    expect(err.constraint_name).toBe('scans_targets_not_empty');
  });

  it('allows the same fingerprint on different pages but not twice on one', async () => {
    const scan = await newScan();
    const issue = {
      scanId: scan.id,
      ruleId: 'image-alt',
      impact: 'critical' as const,
      help: 'Images must have alternative text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
      wcag: ['1.1.1'],
      pageUrl: 'https://example.com/',
      selector: 'img.logo',
      html: '<img class="logo" src="logo.png">',
      fingerprint: 'fp-1',
      groupKey: 'image-alt',
      priority: 0,
    };
    await db.insert(issues).values([issue, { ...issue, pageUrl: 'https://example.com/about' }]);
    const err = await pgError(db.insert(issues).values(issue));
    expect(err.code).toBe('23505');
  });

  it('keys cached explanations by cache_key', async () => {
    const row = {
      cacheKey: `test-${crypto.randomUUID()}`,
      ruleId: 'image-alt',
      body: { whatsWrong: 'a', whoItAffects: 'b', whyItMatters: 'c', confidence: 0.9 },
      model: 'test-model',
      promptVersion: 'v1',
      costUsd: 0.000123,
    };
    try {
      const [saved] = await db.insert(explanations).values(row).returning();
      expect(saved!.costUsd).toBe(0.000123);
      expect(saved!.body).toEqual(row.body);
      const err = await pgError(db.insert(explanations).values(row));
      expect(err.code).toBe('23505');
    } finally {
      await db.delete(explanations).where(eq(explanations.cacheKey, row.cacheKey));
    }
  });

  it('requires an end reason exactly when a run has ended', async () => {
    const scan = await newScan();
    const run = { scanId: scan.id, kind: 'pipeline' as const, model: 'm', promptVersion: 'v1' };
    const err = await pgError(db.insert(agentRuns).values({ ...run, status: 'ended' }));
    expect(err.constraint_name).toBe('agent_runs_end_reason_check');
    await db.insert(agentRuns).values({ ...run, status: 'ended', endReason: 'completed' });
  });

  it('round-trips an agent step through the core schema', async () => {
    const scan = await newScan();
    const [run] = await db
      .insert(agentRuns)
      .values({ scanId: scan.id, kind: 'agent', model: 'm', promptVersion: 'v1' })
      .returning();
    await db.insert(agentSteps).values({
      runId: run!.id,
      seq: 0,
      type: 'tool_call',
      payload: { toolCallId: 'call-1', tool: 'read_file', input: { path: 'src/App.tsx' } },
    });
    const [row] = await db.select().from(agentSteps).where(eq(agentSteps.runId, run!.id));
    const payload = row!.payload as Record<string, unknown>;
    const step = AgentStep.parse({
      ...payload,
      runId: row!.runId,
      index: row!.seq,
      type: row!.type,
      createdAt: row!.createdAt.toISOString(),
    });
    expect(step.type).toBe('tool_call');

    const err = await pgError(
      db.insert(agentSteps).values({ runId: run!.id, seq: 0, type: 'thought', payload: {} }),
    );
    expect(err.code).toBe('23505');
  });

  it('defaults new jobs to queued with three attempts', async () => {
    const [job] = await db
      .insert(jobs)
      .values({ type: 'scan', payload: { scanId: 'x' } })
      .returning();
    try {
      expect(job).toMatchObject({ status: 'queued', attempts: 0, maxAttempts: 3 });
    } finally {
      await db.delete(jobs).where(eq(jobs.id, job!.id));
    }
  });
});
