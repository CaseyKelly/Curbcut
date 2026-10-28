import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateDataset } from './dataset';

const INPUT = `export default function Tile() {
  return (
    <div>
      <img src="/fern.jpg" />
    </div>
  );
}
`;
const FIXED = INPUT.replace('<img src="/fern.jpg" />', '<img src="/fern.jpg" alt="Fern" />');

const issue = {
  ruleId: 'image-alt',
  impact: 'critical',
  help: 'Images must have alternative text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
  wcag: ['1.1.1'],
  pageUrl: 'http://localhost/',
  selector: 'img',
  html: '<img src="/fern.jpg">',
  fingerprint: 'image-alt:img',
};

let root: string;
const write = (path: string, content: string) => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};
const writeCase = (id: string, overrides: Record<string, unknown> = {}) =>
  write(
    `cases/${id}/case.json`,
    JSON.stringify({
      id,
      description: 'An image with no alt.',
      category: 'images',
      filePath: 'Tile.tsx',
      issue,
      expectedOutcome: 'fix',
      allowedLines: [{ start: 4, end: 4 }],
      ...overrides,
    }),
  );
const writeManifest = (cases: string[]) =>
  write('manifest.json', JSON.stringify({ datasetVersion: 1, cases }));
const errors = () => validateDataset(root).errors;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'evals-dataset-'));
  writeManifest(['image-alt']);
  writeCase('image-alt');
  write('cases/image-alt/input/Tile.tsx', INPUT);
  write('cases/image-alt/expected/Tile.tsx', FIXED);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('validateDataset', () => {
  it('passes a valid dataset and loads its cases', () => {
    const report = validateDataset(root);
    expect(report.errors).toEqual([]);
    expect(report.manifest?.datasetVersion).toBe(1);
    expect(report.cases.map((c) => c.case.id)).toEqual(['image-alt']);
  });

  it('passes a no-change case with no expected/', () => {
    writeManifest(['image-alt', 'already-fine']);
    writeCase('already-fine', { expectedOutcome: 'no_change_needed', allowedLines: undefined });
    write('cases/already-fine/input/Tile.tsx', FIXED);
    expect(errors()).toEqual([]);
  });

  it('rejects a case.json that does not match EvalCase', () => {
    writeCase('image-alt', { allowedLines: undefined });
    expect(errors()).toEqual([expect.stringContaining('does not match EvalCase')]);
  });

  it('rejects invalid JSON', () => {
    write('cases/image-alt/case.json', '{');
    expect(errors()).toEqual([expect.stringContaining('not valid JSON')]);
  });

  it('rejects an id that does not match the folder', () => {
    writeCase('image-alt', { id: 'other-id' });
    expect(errors()).toEqual([expect.stringContaining('does not match its folder')]);
  });

  it('rejects a missing input file', () => {
    writeCase('image-alt', { filePath: 'Missing.tsx' });
    expect(errors()).toEqual(['image-alt: input/Missing.tsx does not exist']);
  });

  it('rejects allowedLines past the end of the file', () => {
    writeCase('image-alt', { allowedLines: [{ start: 4, end: 40 }] });
    expect(errors()).toEqual([expect.stringContaining('runs past the end of Tile.tsx (7 lines)')]);
  });

  it('rejects sourceFiles that do not exist', () => {
    writeCase('image-alt', { sourceFiles: ['Card.tsx'] });
    expect(errors()).toEqual(['image-alt: sourceFiles: input/Card.tsx does not exist']);
  });

  it('rejects unexpected entries in a case folder', () => {
    write('cases/image-alt/notes.md', 'hi');
    expect(errors()).toEqual(['image-alt: unexpected entry "notes.md"']);
  });

  it('rejects expected/ on a case that is not a fix', () => {
    writeCase('image-alt', { expectedOutcome: 'unsure', allowedLines: undefined });
    expect(errors()).toEqual([expect.stringContaining('expected/ is only allowed')]);
  });

  it('rejects expected/ holding other files', () => {
    write('cases/image-alt/expected/Other.tsx', FIXED);
    expect(errors()).toEqual([
      'image-alt: expected/ must hold only Tile.tsx, found: Other.tsx, Tile.tsx',
    ]);
  });

  it('rejects a reference fix identical to the input', () => {
    write('cases/image-alt/expected/Tile.tsx', INPUT);
    expect(errors()).toEqual(['image-alt: expected/Tile.tsx is the same as the input']);
  });

  it('rejects a reference fix outside allowedLines', () => {
    write('cases/image-alt/expected/Tile.tsx', FIXED.replace('<div>', '<div className="tile">'));
    expect(errors()).toEqual(['image-alt: expected/Tile.tsx changes line 3, outside allowedLines']);
  });

  it('allows a reference fix that adds lines next to an allowed line', () => {
    write(
      'cases/image-alt/expected/Tile.tsx',
      INPUT.replace('      <img', '      <p>Fern</p>\n      <img'),
    );
    writeCase('image-alt');
    expect(errors()).toEqual([]);
  });

  it('rejects a manifest that does not match the case folders', () => {
    writeManifest(['image-alt', 'gone']);
    write('cases/unlisted/input/Tile.tsx', INPUT);
    writeCase('unlisted');
    expect(errors()).toEqual([
      'manifest.json: lists "gone", which has no folder in cases/',
      'manifest.json: does not list cases/unlisted',
    ]);
  });

  it('rejects a manifest with no version', () => {
    write('manifest.json', JSON.stringify({ cases: ['image-alt'] }));
    expect(errors()).toEqual([expect.stringContaining('at datasetVersion')]);
  });

  it('rejects a manifest that repeats a case', () => {
    writeManifest(['image-alt', 'image-alt']);
    expect(errors()).toEqual([expect.stringContaining('cases must not repeat')]);
  });
});

describe('the real dataset', () => {
  it('is valid', () => {
    const real = resolve(import.meta.dirname, '../../dataset');
    const report = validateDataset(real);
    expect(report.errors).toEqual([]);
    const manifest = JSON.parse(readFileSync(join(real, 'manifest.json'), 'utf8')) as {
      cases: string[];
    };
    expect(report.cases).toHaveLength(manifest.cases.length);
  });
});
