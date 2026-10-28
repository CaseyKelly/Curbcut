import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page and route handler except the public ones checks the session
 * itself (#4), so a gap in the proxy matcher can't expose one.
 */
const appDir = join(import.meta.dirname, '..', 'app');

/** Keep in step with PUBLIC_PATHS in access.ts. */
const PUBLIC_FILES = new Set([
  'sign-in/page.tsx',
  'not-authorized/page.tsx',
  'api/auth/[...nextauth]/route.ts',
]);

function entryFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entryFiles(path);
    return /^(page|route)\.tsx?$/.test(entry.name) ? [relative(appDir, path)] : [];
  });
}

describe('session checks', () => {
  const files = entryFiles(appDir);

  it('finds the app entry files', () => {
    expect(files).toContain('page.tsx');
    for (const file of PUBLIC_FILES) expect(files).toContain(file);
  });

  it.each(files.filter((file) => !PUBLIC_FILES.has(file)))('%s checks the session', (file) => {
    const source = readFileSync(join(appDir, file), 'utf8');
    expect(source).toMatch(/\b(requireUser|currentLogin)\(/);
  });
});
