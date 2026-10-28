// Shared Zod schemas: the contract between the app, the agent, and the evals.
// Every schema is exported with its inferred type under the same name.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Building blocks

/** axe-core impact levels, lowest to highest. */
export const Impact = z.enum(['minor', 'moderate', 'serious', 'critical']);
export type Impact = z.infer<typeof Impact>;

/** Model confidence, 0 to 1. */
export const Confidence = z.number().min(0).max(1);
export type Confidence = z.infer<typeof Confidence>;

/** A WCAG success criterion number, e.g. "1.4.3". */
export const WcagCriterion = z.string().regex(/^[1-4]\.\d{1,2}\.\d{1,2}$/);
export type WcagCriterion = z.infer<typeof WcagCriterion>;

/**
 * A path relative to the repo or case root. Absolute paths and `..` segments
 * are rejected so a path from the model can never point outside the root.
 */
export const RelativePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(p), 'must be relative')
  .refine((p) => !p.split(/[\\/]/).includes('..'), 'must not contain ".."');
export type RelativePath = z.infer<typeof RelativePath>;

// ---------------------------------------------------------------------------
// Scanning

/** One axe violation on one element, normalized by the scanner (#5). */
export const A11yIssue = z.object({
  ruleId: z.string().min(1),
  impact: Impact,
  /** axe `help`: a one-line summary of the rule. */
  help: z.string().min(1),
  helpUrl: z.url(),
  wcag: z.array(WcagCriterion),
  pageUrl: z.url(),
  /** CSS selector for the element, from axe `target`. */
  selector: z.string().min(1),
  /** The element's outer HTML as axe reported it. */
  html: z.string(),
  failureSummary: z.string().optional(),
  /** Stable across scans: used to tell resolved, still present, and new issues apart (#28). */
  fingerprint: z.string().min(1),
});
export type A11yIssue = z.infer<typeof A11yIssue>;

/** Plain-language explanation of an issue group, produced by the model (#7). */
export const IssueExplanation = z.object({
  whatsWrong: z.string().min(1),
  whoItAffects: z.string().min(1),
  whyItMatters: z.string().min(1),
  confidence: Confidence,
});
export type IssueExplanation = z.infer<typeof IssueExplanation>;

// ---------------------------------------------------------------------------
// Fixing

export const PatchOutcome = z.enum(['fix', 'no_change_needed', 'unsure']);
export type PatchOutcome = z.infer<typeof PatchOutcome>;

/**
 * The result of `proposeFix` (#9). A `fix` must carry the file and a unified
 * diff; `no_change_needed` and `unsure` must not, and `unsure` must ask a
 * question for the reviewer (#24).
 */
export const PatchProposal = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('fix'),
    filePath: RelativePath,
    diff: z.string().min(1),
    explanation: z.string().min(1),
    confidence: Confidence,
  }),
  z.object({
    outcome: z.literal('no_change_needed'),
    explanation: z.string().min(1),
    confidence: Confidence,
  }),
  z.object({
    outcome: z.literal('unsure'),
    question: z.string().min(1),
    explanation: z.string().min(1),
    confidence: Confidence,
  }),
]);
export type PatchProposal = z.infer<typeof PatchProposal>;

// ---------------------------------------------------------------------------
// Agent runs

export const ToolName = z.enum([
  'run_scan',
  'read_file',
  'search_repo',
  'propose_patch',
  'apply_patch',
  'open_pr',
]);
export type ToolName = z.infer<typeof ToolName>;

/** Why a run stopped (#22, #27). */
export const RunEndReason = z.enum([
  'completed',
  'awaiting_approval',
  'max_steps',
  'cost_cap',
  'timeout',
  'error',
]);
export type RunEndReason = z.infer<typeof RunEndReason>;

const stepBase = {
  runId: z.string().min(1),
  /** Position in the run, starting at 0. */
  index: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
};

/** One row of `agent_steps`, streamed to the UI as the run progresses (#22). */
export const AgentStep = z.discriminatedUnion('type', [
  z.object({ ...stepBase, type: z.literal('thought'), text: z.string() }),
  z.object({
    ...stepBase,
    type: z.literal('tool_call'),
    toolCallId: z.string().min(1),
    tool: ToolName,
    input: z.unknown(),
  }),
  z.object({
    ...stepBase,
    type: z.literal('tool_result'),
    toolCallId: z.string().min(1),
    tool: ToolName,
    output: z.unknown(),
    /** Tool errors are returned to the model rather than thrown. */
    isError: z.boolean(),
  }),
  z.object({
    ...stepBase,
    type: z.literal('end'),
    reason: RunEndReason,
    message: z.string().optional(),
  }),
]);
export type AgentStep = z.infer<typeof AgentStep>;

// ---------------------------------------------------------------------------
// Evals

/** Inclusive, 1-based line range in the input file. */
export const LineRange = z
  .object({ start: z.int().positive(), end: z.int().positive() })
  .refine((r) => r.end >= r.start, 'end must be >= start');
export type LineRange = z.infer<typeof LineRange>;

/** `case.json` in `packages/evals/dataset/cases/<id>/` (#12). */
export const EvalCase = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case'),
    description: z.string().min(1),
    category: z.string().min(1),
    /** e.g. `smoke` for the fast tier (#14). */
    tags: z.array(z.string().min(1)).default([]),
    /** The file under `input/` the issue lives in. */
    filePath: RelativePath,
    issue: A11yIssue,
    expectedOutcome: PatchOutcome,
    /** Lines a fix may touch; scorer (c) fails diffs outside them (#13). */
    allowedLines: z.array(LineRange).optional(),
    /** Repo mode: the source file(s) the issue maps to (#25). */
    sourceFiles: z.array(RelativePath).min(1).optional(),
  })
  .refine((c) => c.expectedOutcome === 'fix' || c.allowedLines === undefined, {
    message: 'allowedLines only applies when expectedOutcome is "fix"',
    path: ['allowedLines'],
  });
export type EvalCase = z.infer<typeof EvalCase>;

/** LLM-as-judge output, scorer (d) (#15). */
export const JudgeVerdict = z.object({
  score: z.int().min(1).max(5),
  reason: z.string().min(1),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;

/**
 * One case's result in an eval run (#13, #16). Each scorer is optional so a
 * run can skip scorers (e.g. no judge in the smoke tier).
 */
export const EvalResult = z.object({
  caseId: z.string().min(1),
  outcome: PatchOutcome,
  /** Whether the outcome matched the case's `expectedOutcome`. */
  outcomeCorrect: z.boolean(),
  scores: z.object({
    /** (a) target violation gone and no new violations. */
    resolved: z.boolean().optional(),
    /** (b) tsc, ESLint, and the case's own test pass. */
    buildSafe: z.boolean().optional(),
    /** (c) diff stays within the allowed lines. */
    scoped: z.boolean().optional(),
    /** (d) judge score and reason, with the judge's own versions. */
    judge: JudgeVerdict.extend({
      model: z.string().min(1),
      promptVersion: z.string().min(1),
    }).optional(),
    /** Repo mode: mapped to the right source file (#25). */
    mappingCorrect: z.boolean().optional(),
  }),
  /** (e) cost and latency. */
  costUsd: z.number().nonnegative(),
  latencyMs: z.int().nonnegative(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  /** Set when the case crashed instead of producing a proposal. */
  error: z.string().optional(),
});
export type EvalResult = z.infer<typeof EvalResult>;
