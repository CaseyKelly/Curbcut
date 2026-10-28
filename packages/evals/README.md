# @a11y-fixer/evals

Evals for `proposeFix` and the agent.

```
dataset/
  manifest.json        # datasetVersion (#12)
  CHANGELOG.md         # dataset versions (#14)
  cases/<id>/
    case.json          # validated against EvalCase
    input/             # files given to the model
    expected/          # optional reference fix
    test.tsx           # optional per-case test
src/
  runner/              # runs proposeFix over the dataset (#13)
  scorers/             # resolved, build-safe, scoped, judge, cost/latency (#13, #15)
```

Files under `dataset/cases/` are excluded from ESLint and Prettier on purpose. They hold deliberately broken code, and their exact bytes matter for diffs.
