// Scans the sample site with axe and checks the result against
// issues.manifest.json: every seeded issue must be found, nothing else may be
// flagged, the correct patterns must stay clean, and every file the manifest
// names must exist.
//
// Run with `npm run scan -w @curbcut/sample-site`. Needs Chromium:
// `npx playwright install chromium`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { AXE_WCAG_TAGS, RelativePath } from '@curbcut/core';
import { chromium, type Browser } from 'playwright';
import { build, preview } from 'vite';
import { z } from 'zod';

// Rules axe reports on a container rather than on the elements inside it. A
// correct pattern inside such a container is broken too.
const CONTAINER_RULES = [
  'aria-hidden-focus',
  'aria-required-children',
  'definition-list',
  'list',
  'nested-interactive',
];

const Entry = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  category: z.string().min(1),
  file: RelativePath,
  component: z.string().min(1).nullable(),
  relatedFiles: z.array(RelativePath).optional(),
  selector: z.string().min(1),
  description: z.string().min(1),
});

const Manifest = z
  .strictObject({
    manifestVersion: z.literal(1),
    page: z.string().startsWith('/'),
    // `nodes` is how many elements axe flags for the issue, so a fix that
    // resolves only some of them still fails.
    issues: z.array(Entry.extend({ ruleId: z.string().min(1), nodes: z.int().positive() })),
    correctPatterns: z.array(Entry),
  })
  .superRefine((m, ctx) => {
    const ids = [...m.issues, ...m.correctPatterns].map((e) => e.id);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dupes.length > 0) {
      ctx.addIssue({ code: 'custom', message: `Duplicate ids: ${dupes.join(', ')}` });
    }
  });

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = Manifest.parse(
  JSON.parse(readFileSync(new URL('../issues.manifest.json', import.meta.url), 'utf8')),
);
const entries = [...manifest.issues, ...manifest.correctPatterns];
const missingFiles = entries.flatMap((e) =>
  [e.file, ...(e.relatedFiles ?? [])]
    .filter((f) => !existsSync(join(root, f)))
    .map((f) => `${e.id} (${f})`),
);

// A production build served statically, so no dependency discovery or HMR
// reload can change the page while axe runs.
await build({ root, logLevel: 'error' });
const server = await preview({ root, logLevel: 'error', preview: { port: 0 } });

let browser: Browser | undefined;
let failed = false;
try {
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error('Vite did not report a local URL');

  browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(manifest.page, baseUrl).href);
  await page.locator('main').waitFor();

  const results = await new AxeBuilder({ page }).withTags([...AXE_WCAG_TAGS]).analyze();
  const toNodes = (list: typeof results.violations) =>
    list.flatMap((r) => r.nodes.map((n) => ({ ruleId: r.id, target: n.target.map(String) })));
  const nodes = toNodes(results.violations);
  const incomplete = toNodes(results.incomplete);

  // Match in the page, where selectors resolve to the same elements axe saw.
  const { matches, invalidSelectors, missingSelectors, flaggedPatterns } = await page.evaluate(
    ({ issues, patterns, nodes, incomplete, containerRules }) => {
      const invalidSelectors: string[] = [];
      const byId = new Map<string, Element[]>();
      for (const e of [...issues, ...patterns]) {
        try {
          byId.set(e.id, [...document.querySelectorAll(e.selector)]);
        } catch {
          invalidSelectors.push(`${e.id} (${e.selector})`);
          byId.set(e.id, []);
        }
      }
      const missingSelectors = [...issues, ...patterns]
        .filter(
          (e) =>
            byId.get(e.id)!.length === 0 && !invalidSelectors.some((s) => s.startsWith(`${e.id} `)),
        )
        .map((e) => e.id);

      // Nodes inside iframes have a multi-part target; none are seeded.
      const resolve = (n: { target: string[] }) =>
        n.target.length === 1 ? document.querySelector(n.target[0]!) : null;
      const elements = nodes.map(resolve);

      // Every issue a node fits, so overlapping entries show up as ambiguous
      // instead of the first one silently taking the node.
      const matches = nodes.map((n, i) => {
        const el = elements[i];
        if (!el) return [];
        return issues
          .filter((s) => s.ruleId === n.ruleId && byId.get(s.id)!.includes(el))
          .map((s) => s.id);
      });

      // A pattern is broken by a violation or an incomplete result on or
      // inside it, or by a container rule reported on one of its ancestors.
      // Seeded container issues don't count on ancestors: the product photos
      // sit inside the seeded broken list by design.
      const hits = [
        ...nodes.map((n, i) => ({
          n,
          el: elements[i],
          kind: 'violation',
          seeded: matches[i]!.length > 0,
        })),
        ...incomplete.map((n) => ({ n, el: resolve(n), kind: 'incomplete', seeded: false })),
      ];
      const touches = (pe: Element, hit: (typeof hits)[number]) =>
        !!hit.el &&
        (pe.contains(hit.el) ||
          (!hit.seeded && containerRules.includes(hit.n.ruleId) && hit.el.contains(pe)));
      const flaggedPatterns = patterns.flatMap((p) => {
        const patternHits = hits.filter((hit) => byId.get(p.id)!.some((pe) => touches(pe, hit)));
        return patternHits.map(({ n, kind }) => `${p.id} (${n.ruleId}, ${kind})`);
      });

      return { matches, invalidSelectors, missingSelectors, flaggedPatterns };
    },
    {
      issues: manifest.issues,
      patterns: manifest.correctPatterns,
      nodes,
      incomplete,
      containerRules: CONTAINER_RULES,
    },
  );

  console.log(
    `Scanned ${baseUrl} with axe ${results.testEngine.version} (${AXE_WCAG_TAGS.join(', ')})\n`,
  );
  for (const issue of manifest.issues) {
    const count = matches.filter((m) => m.length === 1 && m[0] === issue.id).length;
    const status = count === issue.nodes ? 'found ' : count === 0 ? 'MISSED' : 'COUNT ';
    const counted = count === issue.nodes ? `${count}` : `${count} of ${issue.nodes}`;
    console.log(`${status}  ${issue.ruleId.padEnd(24)} ${issue.id} (${counted})`);
    if (count !== issue.nodes) failed = true;
  }

  const report = (heading: string, lines: string[]) => {
    if (lines.length === 0) return;
    failed = true;
    console.log(`\n${heading}`);
    for (const line of lines) console.log(`  ${line}`);
  };
  report(
    'Unexpected violations (fix the site or add them to the manifest):',
    nodes
      .filter((_, i) => matches[i]!.length === 0)
      .map((n) => `${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}`),
  );
  report(
    'Violations that fit more than one issue (narrow the selectors):',
    nodes.flatMap((n, i) =>
      matches[i]!.length > 1
        ? [`${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}: ${matches[i]!.join(', ')}`]
        : [],
    ),
  );
  report("Files that don't exist:", missingFiles);
  report('Invalid selectors:', invalidSelectors);
  report('Selectors that match nothing:', missingSelectors);
  report('Correct patterns with violations or incomplete results:', flaggedPatterns);

  console.log(
    failed
      ? '\nScan does not match the manifest.'
      : `\nAll ${manifest.issues.length} seeded issues found, ${manifest.correctPatterns.length} correct patterns clean, nothing unexpected.`,
  );
} finally {
  await browser?.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
