// What the runner scores. The live fixer will call `proposeFix` from
// @curbcut/agent once it lands (#9). Until then, and for checking the
// harness itself, there are two fixers that cost nothing:
//
// - reference: answers every case with its expected outcome, and fix cases
//   with the diff from input/ to expected/. Every case should pass; if one
//   doesn't, the harness or the case is wrong, not the agent.
// - replay: returns the proposals saved in an earlier run's JSON report, so a
//   change to the scorers or the harness can be checked for free.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PatchProposal, type EvalCase } from '@curbcut/core';
import { createPatch } from 'diff';
import { RunReport } from './report.ts';

export type FixerResult = {
  proposal: unknown;
  costUsd: number;
  /** Set when the fixer knows better than the runner's wall clock (replay). */
  latencyMs?: number;
};

export interface Fixer {
  model: string;
  promptVersion: string;
  /** `dir` is the case folder; only the reference fixer may look past input/. */
  propose(c: EvalCase, input: string, dir: string, datasetVersion: number): Promise<FixerResult>;
}

export const referenceFixer: Fixer = {
  model: 'reference',
  promptVersion: 'expected',
  propose(c, input, dir) {
    let proposal: PatchProposal;
    const explanation = 'Reference answer from the dataset.';
    if (c.expectedOutcome === 'fix') {
      const expected = readFileSync(join(dir, 'expected', c.filePath), 'utf8');
      const diff = createPatch(c.filePath, input, expected);
      proposal = { outcome: 'fix', filePath: c.filePath, diff, explanation, confidence: 1 };
    } else if (c.expectedOutcome === 'unsure') {
      proposal = { outcome: 'unsure', question: 'Reference question.', explanation, confidence: 1 };
    } else {
      proposal = { outcome: 'no_change_needed', explanation, confidence: 1 };
    }
    return Promise.resolve({ proposal, costUsd: 0 });
  },
};

/** Replays the proposals in a saved report. Throws if the report doesn't parse. */
export function replayFixer(reportPath: string): Fixer {
  const report = RunReport.parse(JSON.parse(readFileSync(reportPath, 'utf8')));
  const byCase = new Map(report.cases.map((r) => [r.result.caseId, r]));
  return {
    model: report.model,
    promptVersion: report.promptVersion,
    // In a promise executor, so a stale or missing recording rejects like a live failure would.
    propose: (c, _input, _dir, datasetVersion) =>
      new Promise((resolve) => {
        const r = byCase.get(c.id);
        if (!r) throw new Error(`no recording for this case in ${reportPath}`);
        const { result } = r;
        // A case that changed since the recording would score a stale answer.
        if (result.caseVersion !== c.version || result.datasetVersion !== datasetVersion) {
          throw new Error(
            `recorded against case v${result.caseVersion} of dataset v${result.datasetVersion}, ` +
              `now case v${c.version} of dataset v${datasetVersion}`,
          );
        }
        if (result.outcome === 'error') throw new Error(`recorded error: ${result.error}`);
        if (!r.proposal) throw new Error('recording has no proposal');
        resolve({ proposal: r.proposal, costUsd: result.costUsd, latencyMs: result.latencyMs });
      }),
  };
}
