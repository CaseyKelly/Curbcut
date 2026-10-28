# Eval dataset

Each case is one accessibility issue in one React component, with the outcome the agent should reach. The runner (#13) gives the agent the input file and the issue, then scores what it proposes.

```bash
npm run evals:validate   # check every case and the manifest (CI runs this)
```

## Layout

```
manifest.json            datasetVersion and the list of case ids
tsconfig.json            type-checks every input/ and expected/ file
cases/<id>/
  case.json              an EvalCase (packages/core)
  input/<file>.tsx       the file as the agent sees it
  expected/<file>.tsx    optional: a reference fix, for fix cases only
  test.tsx               optional: the case's own test, run by scorer (b)
```

- **`case.json`**: `id` matches the folder. `filePath` names the file under `input/`. `issue` is the axe violation as the scanner reports it (#5). `expectedOutcome` is `fix`, `no_change_needed`, or `unsure`. `allowedLines` (fix cases only) are the 1-based input lines a fix may touch. Scorer (c) fails a diff outside them, so leave room for other reasonable fixes, not just the reference one.
- **`input/`**: one self-contained component that default-exports a component taking no props, so the harness can render it on its own. Imports are limited to `react`. Styles are inline, so contrast cases render the same anywhere. Inputs must compile: the bugs are accessibility bugs, not type errors.
- **`expected/`**: the fix we'd want, which the LLM judge (#15) can compare against. It must hold only `filePath`, and every change must fall inside `allowedLines`. An added line counts as inside when a line next to it is allowed.

## Outcomes

- **`fix`**: the issue is real and belongs in this file.
- **`no_change_needed`**: the report is stale and the code is already correct, often in a way an over-eager agent would "improve" (a decorative `alt=""`, a visually hidden label). Any diff fails.
- **`unsure`**: the fix needs information the code doesn't have, such as where an unlabelled icon link goes. The agent should ask rather than guess.

## Categories

`images`, `names`, `forms`, `aria`, `contrast`, `structure`, matching the sample site's categories.

## Adding or changing a case

1. Add the folder and its id in `manifest.json`, and bump `datasetVersion` when any case is added, removed, or changed, so results from different versions aren't compared.
2. Take `issue` from a real axe run on the input, rendered inside `<html lang="en">` with a `<title>` and a `<main>`. For fix and unsure cases, axe should report exactly that one violation. For no-change cases it should report nothing, and `issue` is what an earlier version of the file produced. A fix case's `expected/` file should come back clean.
3. Run `npm run evals:validate` and `npm run typecheck`.

Don't comment the bugs in the input files: the agent reads them.

ESLint and Prettier skip this folder because the inputs are broken on purpose.
