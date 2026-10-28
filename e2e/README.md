# E2E

Playwright tests for the main flows (#29), plus the axe accessibility gate for our own app (#30).

- Runs against LLM replay and a dedicated test repo, so there's no live LLM spend.
- Runs on every PR in under 10 minutes and uploads traces on failure.
