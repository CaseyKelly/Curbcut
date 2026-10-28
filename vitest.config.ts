import { defineConfig } from "vitest/config";

// Unit tests only. E2E lives in /e2e (Playwright) and evals in packages/evals.
export default defineConfig({
  test: {
    include: ["{apps,packages}/**/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "packages/evals/dataset/**"],
    passWithNoTests: true,
  },
});
