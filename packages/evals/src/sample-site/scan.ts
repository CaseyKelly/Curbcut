// Scans fixtures/sample-site with axe and checks the result against
// ../../sample-site/issues.manifest.json: every seeded issue must be found,
// nothing else may be flagged, the correct patterns must stay clean, and
// every file the manifest names must exist.
//
// Run with `npm run scan:sample-site`. Needs Chromium:
// `npx playwright install chromium`.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { AXE_WCAG_TAGS } from '@curbcut/core';
import { chromium, type Browser } from 'playwright';
import { build, preview } from 'vite';
import { SampleSiteManifest } from './manifest.ts';
import { CONTAINER_RULES, matchInDocument, summarize, type AxeNode } from './match.ts';

const siteRoot = fileURLToPath(new URL('../../../../fixtures/sample-site/', import.meta.url));
const manifest = SampleSiteManifest.parse(
  JSON.parse(
    readFileSync(new URL('../../sample-site/issues.manifest.json', import.meta.url), 'utf8'),
  ),
);
const missingFiles = [...manifest.issues, ...manifest.correctPatterns].flatMap((e) =>
  [e.file, ...(e.relatedFiles ?? [])]
    .filter((f) => !existsSync(join(siteRoot, f)))
    .map((f) => `${e.id} (${f})`),
);

// A production build served statically, so no dependency discovery or HMR
// reload can change the page while axe runs. It goes to a temp directory so
// the scan never writes into the fixture, which must stay exactly what the
// agent sees in repo mode.
const outDir = mkdtempSync(join(tmpdir(), 'fernleaf-'));
let server: Awaited<ReturnType<typeof preview>> | undefined;
let browser: Browser | undefined;
let failed = false;
try {
  await build({ root: siteRoot, logLevel: 'error', build: { outDir, emptyOutDir: true } });
  server = await preview({
    root: siteRoot,
    logLevel: 'error',
    build: { outDir },
    preview: { port: 0 },
  });
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error('Vite did not report a local URL');

  browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(manifest.page, baseUrl).href);
  await page.locator('main').waitFor();
  // The store map is an iframe; let it finish loading so axe sees its title
  // and contents rather than an empty frame.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('iframe')].every(
      (f) =>
        f.contentWindow?.location.href !== 'about:blank' &&
        f.contentDocument?.readyState === 'complete',
    ),
  );

  const results = await new AxeBuilder({ page }).withTags([...AXE_WCAG_TAGS]).analyze();
  const toNodes = (list: typeof results.violations): AxeNode[] =>
    list.flatMap((r) => r.nodes.map((n) => ({ ruleId: r.id, target: n.target.map(String) })));
  const violations = toNodes(results.violations);

  // Match in the page, where selectors resolve to the same elements axe saw.
  const result = await page.evaluate(matchInDocument, {
    issues: manifest.issues,
    patterns: manifest.correctPatterns,
    violations,
    incomplete: toNodes(results.incomplete),
    containerRules: CONTAINER_RULES,
  });

  const summary = summarize(
    manifest.issues,
    manifest.correctPatterns,
    violations,
    result,
    missingFiles,
  );
  console.log(
    `Scanned ${baseUrl} with axe ${results.testEngine.version} (${AXE_WCAG_TAGS.join(', ')})\n`,
  );
  console.log(summary.lines.join('\n'));
  failed = summary.failed;
} finally {
  await browser?.close();
  await server?.close();
  rmSync(outDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
