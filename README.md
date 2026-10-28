# a11y-fixer

An AI agent that audits a web page for accessibility issues (WCAG 2.1 AA), explains them in plain language, and proposes code fixes you review before anything is changed.

Built by Casey Kelly and Upasana Kelly-Ajbani. Work is tracked in [Issues](../../issues) and the project board.

## Getting started

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
npm run dev     # web app at http://localhost:3000
npm run check   # format, lint, typecheck, tests (what CI runs)
```

## Layout

| Path                   | What                                         | Owner   |
| ---------------------- | -------------------------------------------- | ------- |
| `apps/web`             | Next.js app: UI, route handlers, auth        | Casey   |
| `apps/worker`          | Job runner: scans and agent runs             | Casey   |
| `packages/core`        | Zod schemas shared by the app and the evals  | Both    |
| `packages/agent`       | LLM provider, prompts, agent loop, tools     | Casey   |
| `packages/db`          | Drizzle schema and migrations                | Casey   |
| `packages/evals`       | Eval dataset, runner, scorers                | Upasana |
| `fixtures/sample-site` | React app with deliberate a11y bugs          | Upasana |
| `e2e`                  | Playwright end-to-end tests                  | Upasana |
| `docs`                 | Test strategy, release checklist, prompt log | Both    |

Workspace packages export TypeScript source directly (no build step). Next.js compiles them through `transpilePackages`, and the worker runs with `tsx`.
