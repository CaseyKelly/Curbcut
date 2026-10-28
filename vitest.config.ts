import { defineConfig } from 'vitest/config';

// One test run for the whole repo. Each workspace keeps its tests next to
// the code as *.test.ts(x); Playwright E2E lives in e2e/ and runs separately.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
