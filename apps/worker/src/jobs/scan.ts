// The `scan` job (#5): scans each of a scan's targets and stores the issues.
import { ScanJobPayload, type A11yIssue } from '@curbcut/core';
import { issues, scans, type Db } from '@curbcut/db';
import { eq, sql } from 'drizzle-orm';
import { PermanentError } from '../errors';
import type { Job } from '../queue';
import type { Scanner } from '../scanner/scanner';
import type { JobHandler } from './types';

export function scanJob(db: Db, scanner: Pick<Scanner, 'scan'>): JobHandler {
  return {
    async run(job: Job) {
      const { scanId } = ScanJobPayload.parse(job.payload);
      const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
      if (!scan) throw new PermanentError(`Scan ${scanId} not found`);

      await db
        .update(scans)
        .set({
          status: 'running',
          error: null,
          startedAt: sql`coalesce(${scans.startedAt}, now())`,
        })
        .where(eq(scans.id, scanId));

      const found: A11yIssue[] = [];
      let axeVersion: string | undefined;
      for (const target of scan.targets) {
        const result = await scanner.scan(target);
        found.push(...result.issues);
        axeVersion = result.axeVersion;
      }

      return async (tx) => {
        // A retry replaces whatever an earlier attempt stored.
        await tx.delete(issues).where(eq(issues.scanId, scanId));
        if (found.length > 0) {
          await tx.insert(issues).values(
            found.map((issue) => ({
              ...issue,
              scanId,
              // Issues are grouped by rule for explanations (#7).
              groupKey: issue.ruleId,
            })),
          );
        }
        await tx
          .update(scans)
          .set({ status: 'completed', axeVersion, finishedAt: sql`now()` })
          .where(eq(scans.id, scanId));
      };
    },

    async onFailed(job: Job, error: string) {
      const payload = ScanJobPayload.safeParse(job.payload);
      if (!payload.success) return;
      await db
        .update(scans)
        .set({ status: 'failed', error, finishedAt: sql`now()` })
        .where(eq(scans.id, payload.data.scanId));
    },
  };
}
