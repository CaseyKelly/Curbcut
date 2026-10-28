// Matches axe results to the sample-site manifest. `matchInDocument` runs in
// the browser through page.evaluate and in jsdom in the tests; `summarize`
// turns its result into the scan report.

/** One axe node: the rule and its target (one selector per frame). */
export interface AxeNode {
  ruleId: string;
  target: string[];
}

export interface MatchInput {
  issues: { id: string; ruleId: string; selector: string }[];
  patterns: { id: string; selector: string; insideIssues?: string[] }[];
  violations: AxeNode[];
  incomplete: AxeNode[];
  /** Rules axe reports on a container rather than on the elements inside it. */
  containerRules: string[];
}

export interface PatternHit {
  patternId: string;
  ruleId: string;
  kind: 'violation' | 'incomplete';
}

export interface MatchResult {
  /** For each violation, the ids of every issue it fits. */
  matches: string[][];
  invalidSelectors: string[];
  missingSelectors: string[];
  flaggedPatterns: PatternHit[];
}

export const CONTAINER_RULES = [
  'aria-hidden-focus',
  'aria-required-children',
  'definition-list',
  'list',
  'nested-interactive',
];

/**
 * Playwright serializes this function into the page, so it must not use
 * anything from outside its own body: no imports and no module-level values.
 */
export function matchInDocument(input: MatchInput, doc: Document = document): MatchResult {
  const invalid = new Set<string>();
  const byId = new Map<string, Element[]>();
  for (const e of [...input.issues, ...input.patterns]) {
    try {
      byId.set(e.id, [...doc.querySelectorAll(e.selector)]);
    } catch {
      invalid.add(e.id);
      byId.set(e.id, []);
    }
  }
  const elementsOf = (id: string) => byId.get(id) ?? [];

  // Nodes inside iframes have a multi-part target; none are seeded.
  const resolve = (n: AxeNode) => (n.target.length === 1 ? doc.querySelector(n.target[0]!) : null);
  const violationEls = input.violations.map(resolve);

  // Every issue a node fits, so overlapping entries show up as ambiguous
  // instead of the first one silently taking the node.
  const matches = input.violations.map((n, i) => {
    const el = violationEls[i];
    if (!el) return [];
    return input.issues
      .filter((s) => s.ruleId === n.ruleId && elementsOf(s.id).includes(el))
      .map((s) => s.id);
  });

  const hits = [
    ...input.violations.map((n, i) => ({
      n,
      el: violationEls[i] ?? null,
      kind: 'violation' as const,
      issueIds: matches[i]!,
    })),
    ...input.incomplete.map((n) => ({
      n,
      el: resolve(n),
      kind: 'incomplete' as const,
      issueIds: [] as string[],
    })),
  ];

  // A pattern is broken by a violation or an incomplete result on or inside
  // it, or by a container violation on an ancestor, unless the manifest says
  // the pattern sits inside that seeded issue by design.
  const flaggedPatterns: PatternHit[] = [];
  for (const p of input.patterns) {
    const allowed = new Set(p.insideIssues ?? []);
    for (const hit of hits) {
      const el = hit.el;
      if (!el) continue;
      const expected = hit.issueIds.length > 0 && hit.issueIds.every((id) => allowed.has(id));
      const broken = elementsOf(p.id).some(
        (pe) =>
          pe.contains(el) ||
          (input.containerRules.includes(hit.n.ruleId) && el.contains(pe) && !expected),
      );
      if (broken) flaggedPatterns.push({ patternId: p.id, ruleId: hit.n.ruleId, kind: hit.kind });
    }
  }

  const missingSelectors = [...input.issues, ...input.patterns]
    .filter((e) => !invalid.has(e.id) && elementsOf(e.id).length === 0)
    .map((e) => e.id);

  return { matches, invalidSelectors: [...invalid], missingSelectors, flaggedPatterns };
}

export interface Summary {
  failed: boolean;
  lines: string[];
}

export function summarize(
  issues: { id: string; ruleId: string; nodes: number }[],
  patternCount: number,
  violations: AxeNode[],
  result: MatchResult,
  missingFiles: string[] = [],
): Summary {
  const lines: string[] = [];
  let failed = false;

  for (const issue of issues) {
    const count = result.matches.filter((m) => m.length === 1 && m[0] === issue.id).length;
    const ok = count === issue.nodes;
    const status = ok ? 'found ' : count === 0 ? 'MISSED' : 'COUNT ';
    const counted = ok ? `${count}` : `${count} of ${issue.nodes}`;
    lines.push(`${status}  ${issue.ruleId.padEnd(24)} ${issue.id} (${counted})`);
    if (!ok) failed = true;
  }

  const section = (heading: string, items: string[]) => {
    if (items.length === 0) return;
    failed = true;
    lines.push('', heading, ...items.map((item) => `  ${item}`));
  };
  const where = (n: AxeNode) => `${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}`;
  section(
    'Unexpected violations (fix the site or add them to the manifest):',
    violations.filter((_, i) => result.matches[i]!.length === 0).map(where),
  );
  section(
    'Violations that fit more than one issue (narrow the selectors):',
    violations.flatMap((n, i) => {
      const ids = result.matches[i]!;
      return ids.length > 1 ? [`${where(n)}: ${ids.join(', ')}`] : [];
    }),
  );
  section("Files that don't exist:", missingFiles);
  section('Invalid selectors:', result.invalidSelectors);
  section('Selectors that match nothing:', result.missingSelectors);
  section(
    'Correct patterns with violations or incomplete results:',
    result.flaggedPatterns.map((h) => `${h.patternId} (${h.ruleId}, ${h.kind})`),
  );

  lines.push(
    '',
    failed
      ? 'Scan does not match the manifest.'
      : `All ${issues.length} seeded issues found, ${patternCount} correct patterns clean, nothing unexpected.`,
  );
  return { failed, lines };
}
