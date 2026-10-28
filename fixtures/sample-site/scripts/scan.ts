// Scans the sample site with axe and checks the result against
// issues.manifest.json: every seeded issue must be found, nothing else may be
// flagged, and the correct patterns must stay clean.
//
// Run with `npm run scan -w @curbcut/sample-site`. Needs Chromium:
// `npx playwright install chromium`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { z } from 'zod';

// The tags the scanner in apps/worker uses (#5).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const Entry = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  category: z.string().min(1),
  file: z.string().min(1),
  component: z.string().min(1).nullable(),
  relatedFiles: z.array(z.string().min(1)).optional(),
  selector: z.string().min(1),
  description: z.string().min(1),
});

const Manifest = z.strictObject({
  manifestVersion: z.literal(1),
  page: z.string().startsWith('/'),
  issues: z.array(Entry.extend({ ruleId: z.string().min(1) })),
  correctPatterns: z.array(Entry),
});

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = Manifest.parse(
  JSON.parse(readFileSync(new URL('../issues.manifest.json', import.meta.url), 'utf8')),
);

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
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
      const matches = nodes.map((n, i) => {
        const el = elements[i];
        const hit = issues.find((s) => s.ruleId === n.ruleId && el && all(s.selector).includes(el));
        return hit?.id ?? null;
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
    const count = matches.filter((m) => m === issue.id).length;
    console.log(`${count > 0 ? 'found ' : 'MISSED'}  ${issue.ruleId.padEnd(24)} ${issue.id} (${count})`);
    if (count === 0) failed = true;
  }

  const unexpected = nodes.filter((_, i) => matches[i] === null);
  if (unexpected.length > 0) {
    failed = true;
    console.log('\nUnexpected violations (fix the site or add them to the manifest):');
    for (const n of unexpected) console.log(`  ${n.ruleId.padEnd(24)} ${n.target.join(' >> ')}`);
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
