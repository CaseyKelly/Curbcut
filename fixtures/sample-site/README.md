# Sample site

Fernleaf, a small React plant shop with deliberate accessibility bugs. It is the demo target and the repo-mode test repo (#10).

```bash
npm run sample-site                     # dev server at http://localhost:5173
npm run scan -w @curbcut/sample-site    # check the bugs against the manifest
```

The scan needs Chromium once: `npx playwright install chromium`.

## The manifest

`issues.manifest.json` is the answer key:

- **`issues`**: 22 seeded bugs, each with the axe rule, the file a fix belongs in, the component, a CSS selector for the flagged element, and `nodes`, the number of elements axe flags for it (the rating stars, for example, render once per product). `relatedFiles` lists other files a reasonable fix might touch (for example, contrast bugs live in `styles.css` but render from a component).
- **`correctPatterns`**: 8 accessible patterns that look like they might need a fix but don't, such as a decorative image with `alt=""` or an input with a visually hidden label. An agent that "fixes" these is wrong.

Categories: `document`, `images`, `contrast`, `forms`, `names`, `aria`, `structure`, `focus`.

Only rules in axe's WCAG 2.1 A and AA tags are seeded, because that is what the scanner runs (#5). Best-practice rules like `region` and `heading-order` are out of scope.

## The scan

`scripts/scan.ts` starts Vite, loads the page in Chromium, runs axe with the WCAG 2.1 AA tags, and matches every violation to a manifest entry by rule and selector. It fails when:

- a seeded issue is not found, or is flagged on more or fewer elements than its `nodes`
- axe reports a violation that is not in the manifest
- a correct pattern has a violation
- a manifest selector matches nothing, or a violation matches more than one issue
- a manifest `file` or `relatedFiles` path doesn't exist, or two entries share an id

CI runs it on every PR, so the site and the manifest can't drift apart.

## Editing the site

- **Don't comment the bugs in the source.** In repo mode the agent reads these files, and a `// missing alt` comment gives the answer away. The manifest is the only record.
- Add or change a bug and its manifest entry in the same commit, then run the scan.
- ESLint and Prettier skip this folder on purpose. TypeScript still checks it, so the bugs are accessibility bugs, not build errors.
