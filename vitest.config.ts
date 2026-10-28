import { defineConfig } from 'vitest/config';

// One test run for the whole repo. Each workspace keeps its tests next to
// the code as *.test.ts(x); Playwright E2E lives in e2e/ and runs separately.
export default defineConfig({
  test: {
    // Next.js keeps routes in apps/web/app, not src.
    include: ['{apps,packages}/*/{src,app}/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
