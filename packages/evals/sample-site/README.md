# Sample site answer key

[`fixtures/sample-site`](../../../fixtures/sample-site) is Fernleaf, a small React plant shop with deliberate accessibility bugs. It is the demo target and the repo-mode test repo (#10). This folder holds its answer key, kept out of the fixture so the agent never reads it in repo mode.

```bash
npm run sample-site        # dev server at http://localhost:5173
npm run scan:sample-site   # check the bugs against the manifest
```

The scan needs Chromium once: `npx playwright install chromium`.

## Keeping the fixture standalone

`fixtures/sample-site` must work when copied into its own repo, so it holds only the site:

- Its own `tsconfig.json` (no `extends`) and only its own dependencies. Nothing imports from `@curbcut/*`.
- No manifest, scan, or notes that describe the bugs. Its README just says how to run it.
- **Don't comment the bugs in the source.** In repo mode the agent reads every file there, and a `// missing alt` comment gives the answer away.

## The manifest

`issues.manifest.json` is validated by `src/sample-site/manifest.ts`. File paths are relative to `fixtures/sample-site`.

- **`issues`**: 22 seeded bugs, each with the axe rule, the file a fix belongs in, the component, a CSS selector for the flagged element, and `nodes`, the number of elements axe flags for it (the rating stars, for example, render once per product). `relatedFiles` lists other files a reasonable fix might touch (for example, contrast bugs live in `styles.css` but render from a component).
- **`correctPatterns`**: 8 accessible patterns that look like they might need a fix but don't, such as a decorative image with `alt=""` or an input with a visually hidden label. An agent that "fixes" these is wrong. `insideIssues` names a seeded container a pattern sits inside by design (the product photos are inside the broken product list).

Categories: `document`, `images`, `contrast`, `forms`, `names`, `aria`, `structure`, `focus`.

Only rules in axe's WCAG 2.1 A and AA tags (`AXE_WCAG_TAGS` in `@curbcut/core`) are seeded, because that is what the scanner runs (#5). Best-practice rules like `region` and `heading-order` are out of scope.

Seeded bugs must not depend on UI state. A bug that only shows while, say, an accordion is open can be "fixed" by changing the default state, and the scan would count it as resolved.

## The scan

`src/sample-site/scan.ts` builds the site into a temp directory (so the fixture is never written to), serves it with `vite preview`, loads the page in Chromium and waits for its iframe to load, runs axe, and passes the results to `matchInDocument` (`src/sample-site/match.ts`), which runs in the page and matches every node to a manifest entry by rule and selector. It fails when:

- a seeded issue is not found, or is flagged on more or fewer elements than its `nodes`
- axe reports a violation that is not in the manifest
- a correct pattern has a violation or an incomplete result, or sits inside a container violation its `insideIssues` doesn't name
- a manifest selector is invalid or matches nothing, or a violation matches more than one issue
- a manifest `file` or `relatedFiles` path doesn't exist, two entries share an id, or `insideIssues` names an unknown issue

`match.test.ts` covers each of these failures under jsdom (missing files and duplicate ids included), and CI runs the scan on every PR so the site and the manifest can't drift apart.

## Editing the site

- Add or change a bug and its manifest entry in the same commit, then run the scan.
- ESLint and Prettier skip the fixture's `src/` and `index.html` on purpose. TypeScript still checks them, so the bugs are accessibility bugs, not build errors.
