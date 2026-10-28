# a11y-fixer

An AI agent that audits a web page for accessibility issues (WCAG 2.1 AA), explains them in plain language, and proposes code fixes you review before anything is changed.

Built by Casey Kelly and Upasana Kelly-Ajbani. Work is tracked in [Issues](../../issues) and the project board.

## Repo layout

```
apps/
  web/              Next.js app: sign-in, scan, issue list, diff review, /evals
  worker/           Fly.io worker: job queue, Playwright/axe scanner, agent runs
packages/
  core/             Shared Zod schemas: the contract between app, agent and evals
  agent/            LLM provider, explanations, proposeFix, agent loop and tools
  db/               Drizzle schema and migrations
  evals/            Eval dataset, runner, scorers, run comparison
fixtures/
  sample-site/      React app with seeded accessibility bugs (demo + test repo)
e2e/                Playwright E2E and the accessibility gate for our own app
docs/               Test strategy, release checklist, prompt log
```

Workspace packages ship TypeScript source (`exports` points at `src/index.ts`), so there is no build step between packages.

## Getting started

Requires Node 22 (see `.nvmrc`).

```sh
npm install
cp .env.example .env
npm run check
```

## Scripts

| Command                | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run check`        | Typecheck, lint, and unit tests across workspaces |
| `npm run typecheck`    | `tsc --noEmit` in every workspace                 |
| `npm run lint`         | ESLint (incl. `jsx-a11y` strict), zero warnings   |
| `npm test`             | Vitest unit tests                                 |
| `npm run format`       | Prettier, write                                   |
| `npm run format:check` | Prettier, check only (runs in CI)                 |
| `npm run dev:web`      | Start the web app                                 |
| `npm run dev:worker`   | Start the worker                                  |

To run a script in one workspace: `npm run <script> -w @a11y-fixer/<name>`.

## Contributing

- Branch from `main`, open a PR, and link the issue (`Closes #N`).
- CI runs `npm run check` and a formatting check on every PR.
- Changes to `packages/core/` need review from both of us (see `.github/CODEOWNERS`).
- `fixtures/sample-site/` and `packages/evals/dataset/cases/` are excluded from linting on purpose. They contain deliberately inaccessible code.
