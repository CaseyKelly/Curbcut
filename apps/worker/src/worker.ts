// The worker loop (#5): claim a job, run its handler while heartbeating, then
// record success or a failed attempt. One job at a time: a scan holds a
// Chromium page, and the Fly machine is sized for one.
import { setTimeout as sleep } from 'node:timers/promises';
import { ZodError } from 'zod';
import { PermanentError } from './errors';
import type { JobHandler } from './jobs/types';
import { LostJobError, type Job, type Queue } from './queue';

export interface WorkerOptions {
  queue: Queue;
  handlers: Partial<Record<Job['type'], JobHandler>>;
  /** How long to wait before polling again when the queue is empty. */
  pollIntervalMs?: number;
  /** A running job whose lock is older than this is taken for abandoned. */
  lockTimeoutMs?: number;
  log?: (message: string) => void;
}

export function createWorker({
  queue,
  handlers,
  pollIntervalMs = 1_000,
  lockTimeoutMs = 120_000,
  log = console.log,
}: WorkerOptions) {
  /** When the loop last showed signs of life, for the health check. */
  let lastBeat = Date.now();

  async function giveUp(job: Job, error: string) {
    log(`job ${job.id} (${job.type}) failed: ${error}`);
    await handlers[job.type]?.onFailed?.(job, error);
  }

  async function process(job: Job) {
    log(`job ${job.id} (${job.type}) attempt ${job.attempts}/${job.maxAttempts}`);
    const heartbeat = setInterval(() => {
      queue.heartbeat(job).then(
        (held) => {
          if (held) lastBeat = Date.now();
        },
        (err: unknown) => log(`heartbeat failed: ${String(err)}`),
      );
    }, lockTimeoutMs / 4);
    try {
      const handler = handlers[job.type];
      if (!handler) throw new PermanentError(`No handler for ${job.type} jobs yet`);
      const commit = await handler.run(job);
      await queue.complete(job, commit);
      log(`job ${job.id} succeeded`);
    } catch (err) {
      if (err instanceof LostJobError) {
        log(err.message);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const permanent = err instanceof PermanentError || err instanceof ZodError;
      const status = await queue.fail(job, message, { permanent });
      if (status === 'failed') await giveUp(job, message);
      else if (status === 'queued') log(`job ${job.id} will retry: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
  }

  /** Runs one job if one is due. Returns whether it found one. */
  async function tick(): Promise<boolean> {
    const abandoned = await queue.requeueStale(lockTimeoutMs);
    lastBeat = Date.now();
    for (const job of abandoned) await giveUp(job, job.error ?? 'lock expired');
    const job = await queue.claim();
    if (job) await process(job);
    return job !== undefined;
  }

  return {
    tick,

    /** Polls until `signal` aborts, finishing the job in hand first. */
    async run(signal: AbortSignal) {
      while (!signal.aborted) {
        let found = false;
        try {
          found = await tick();
        } catch (err) {
          // A database blip shouldn't kill the worker; the health check reports a long outage.
          log(`poll failed: ${String(err)}`);
        }
        if (!found) await sleep(pollIntervalMs, undefined, { signal }).catch(() => undefined);
      }
    },

    /** Healthy if the loop reached the database recently, by polling or heartbeating. */
    healthy: () => Date.now() - lastBeat < lockTimeoutMs,
  };
}

export type Worker = ReturnType<typeof createWorker>;
