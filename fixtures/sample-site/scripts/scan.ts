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
import { RelativePath } from '@curbcut/core';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { z } from 'zod';

// The tags the scanner in apps/worker uses (#5).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

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
    if (dupes.length > 0) ctx.addIssue({ code: 'custom', message: `Duplicate ids: ${dupes.join(', ')}` });
  });

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = Manifest.parse(
  JSON.parse(readFileSync(new URL('../issues.manifest.json', import.meta.url), 'utf8')),
);
const entries = [...manifest.issues, ...manifest.correctPatterns];
const missingFiles = entries.flatMap((e) =>
  [e.file, ...(e.relatedFiles ?? [])].filter((f) => !existsSync(join(root, f))).map((f) => `${e.id} (${f})`),
);

// forwardConsole off: the seeded bugs make React log warnings in the browser.
const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 0, forwardConsole: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not report a local URL');

const browser = await chromium.launch();
let failed = false;
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(manifest.page, baseUrl).href, { waitUntil: 'networkidle' });
  await page.locator('main').waitFor();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const nodes = results.violations.flatMap((v) =>
    v.nodes.map((n) => ({ ruleId: v.id, target: n.target.map(String) })),
  );

  // Match in the page, where selectors resolve to the same elements axe saw.
  const { matches, missingSelectors, flaggedPatterns } = await page.evaluate(
    ({ issues, patterns, nodes }) => {
      const all = (sel: string) => [...document.querySelectorAll(sel)];
      // Nodes inside iframes have a multi-part target; none are seeded.
      const elements = nodes.map((n) =>
        n.target.length === 1 ? document.querySelector(n.target[0]!) : null,
      );
      // Every issue a node fits, so overlapping entries show up as ambiguous
      // instead of the first one silently taking the node.
      const matches = nodes.map((n, i) => {
        const el = elements[i];
        if (!el) return [];
        return issues.filter((s) => s.ruleId === n.ruleId && all(s.selector).includes(el)).map((s) => s.id);
      });
      const missingSelectors = [...issues, ...patterns]
        .filter((e) => all(e.selector).length === 0)
        .map((e) => e.id);
      const flaggedPatterns = patterns
        .filter((p) => all(p.selector).some((pe) => elements.some((el) => el && pe.contains(el))))
        .map((p) => p.id);
      return { matches, missingSelectors, flaggedPatterns };
    },
    { issues: manifest.issues, patterns: manifest.correctPatterns, nodes },
  );

  console.log(`Scanned ${baseUrl} with axe ${results.testEngine.version} (${WCAG_TAGS.join(', ')})\n`);
  for (const issue of manifest.issues) {
    const count = matches.filter((m) => m.length === 1 && m[0] === issue.id).length;
    const status = count === issue.nodes ? 'found ' : count === 0 ? 'MISSED' : 'COUNT ';
    const counted = count === issue.nodes ? `${count}` : `${count} of ${issue.nodes}`;
    console.log(`${status}  ${issue.ruleId.padEnd(24)} ${issue.id} (${counted})`);
    if (count !== issue.nodes) failed = true;
  }

  const unexpected = nodes.filter((_, i) => matches[i]!.length === 0);
  if (unexpected.length > 0) {
    failed = true;
    console.log('\nUnexpected violations (fix the site or add them to the manifest):');
    for (const n of unexpected) console.log(`  ${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}`);
  }
  const ambiguous = nodes.flatMap((n, i) => (matches[i]!.length > 1 ? [{ ...n, ids: matches[i]! }] : []));
  if (ambiguous.length > 0) {
    failed = true;
    console.log('\nViolations that fit more than one issue (narrow the selectors):');
    for (const n of ambiguous) console.log(`  ${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}: ${n.ids.join(', ')}`);
  }
  if (missingFiles.length > 0) {
    failed = true;
    console.log(`\nFiles that don't exist: ${missingFiles.join(', ')}`);
  }
  if (missingSelectors.length > 0) {
    failed = true;
    console.log(`\nSelectors that match nothing: ${missingSelectors.join(', ')}`);
  }
  if (flaggedPatterns.length > 0) {
    failed = true;
    console.log(`\nCorrect patterns with violations: ${flaggedPatterns.join(', ')}`);
  }

  console.log(
    failed
      ? '\nScan does not match the manifest.'
      : `\nAll ${manifest.issues.length} seeded issues found, ${manifest.correctPatterns.length} correct patterns clean, nothing unexpected.`,
  );
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
