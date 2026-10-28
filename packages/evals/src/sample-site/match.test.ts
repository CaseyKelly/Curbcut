// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { SampleSiteManifest } from './manifest';
import {
  CONTAINER_RULES,
  matchInDocument,
  summarize,
  type AxeNode,
  type MatchInput,
} from './match';

// A tiny page: a seeded broken list holding a correct pattern, and a
// standalone correct pattern.
beforeEach(() => {
  document.body.innerHTML = `
    <ul class="grid"><div class="card"><img class="photo" alt="Fern"></div></ul>
    <button class="named" aria-label="Search"></button>
    <button class="unnamed"></button>
  `;
});

const issues = [
  { id: 'grid-list', ruleId: 'list', selector: '.grid', nodes: 1 },
  { id: 'unnamed-button', ruleId: 'button-name', selector: '.unnamed', nodes: 1 },
];
const patterns = [
  { id: 'photo-alt', selector: '.photo', insideIssues: ['grid-list'] },
  { id: 'named-button', selector: '.named' },
];
const healthy: AxeNode[] = [
  { ruleId: 'list', target: ['.grid'] },
  { ruleId: 'button-name', target: ['.unnamed'] },
];

const run = (overrides: Partial<MatchInput> = {}) => {
  const input: MatchInput = {
    issues,
    patterns,
    violations: healthy,
    incomplete: [],
    containerRules: CONTAINER_RULES,
    ...overrides,
  };
  const result = matchInDocument(input, document);
  return { result, summary: summarize(input.issues as typeof issues, 2, input.violations, result) };
};

describe('matchInDocument + summarize', () => {
  it('passes when every seeded issue is found and nothing else is', () => {
    const { result, summary } = run();
    expect(result.flaggedPatterns).toEqual([]);
    expect(summary.failed).toBe(false);
  });

  it('fails when a seeded issue is missed', () => {
    const { summary } = run({ violations: [healthy[0]!] });
    expect(summary.failed).toBe(true);
    expect(summary.lines.join('\n')).toMatch(/MISSED\s+button-name\s+unnamed-button/);
  });

  it('fails when an issue is flagged on more elements than expected', () => {
    document.body.insertAdjacentHTML('beforeend', '<button class="unnamed"></button>');
    const { summary } = run({
      violations: [...healthy, { ruleId: 'button-name', target: ['.unnamed:last-of-type'] }],
    });
    expect(summary.lines.join('\n')).toMatch(/COUNT\s+button-name\s+unnamed-button \(2 of 1\)/);
  });

  it('fails on an unexpected violation', () => {
    const { summary } = run({
      violations: [...healthy, { ruleId: 'image-alt', target: ['.card'] }],
    });
    expect(summary.failed).toBe(true);
    expect(summary.lines).toContain(
      'Unexpected violations (fix the site or add them to the manifest):',
    );
  });

  it('fails when a violation fits more than one issue', () => {
    const overlapping = [
      ...issues,
      { id: 'any-button', ruleId: 'button-name', selector: 'button', nodes: 1 },
    ];
    const { result } = run({ issues: overlapping });
    expect(result.matches[1]).toEqual(['unnamed-button', 'any-button']);
  });

  it('reports invalid selectors by id instead of throwing', () => {
    const { result, summary } = run({ patterns: [{ id: 'bad', selector: '..named' }] });
    expect(result.invalidSelectors).toEqual(['bad']);
    expect(result.missingSelectors).not.toContain('bad');
    expect(summary.failed).toBe(true);
  });

  it('reports selectors that match nothing', () => {
    const { result } = run({ patterns: [{ id: 'gone', selector: '.nope' }] });
    expect(result.missingSelectors).toEqual(['gone']);
  });

  it('flags a violation on a correct pattern', () => {
    const { result } = run({
      violations: [...healthy, { ruleId: 'button-name', target: ['.named'] }],
    });
    expect(result.flaggedPatterns).toContainEqual({
      patternId: 'named-button',
      ruleId: 'button-name',
      kind: 'violation',
    });
  });

  it('flags an incomplete result inside a correct pattern', () => {
    const { result } = run({ incomplete: [{ ruleId: 'color-contrast', target: ['.named'] }] });
    expect(result.flaggedPatterns).toEqual([
      { patternId: 'named-button', ruleId: 'color-contrast', kind: 'incomplete' },
    ]);
  });

  it('allows a pattern inside the seeded container the manifest names', () => {
    expect(run().result.flaggedPatterns).toEqual([]);
  });

  it('flags a pattern inside a seeded container the manifest does not name', () => {
    const { result } = run({ patterns: [{ id: 'photo-alt', selector: '.photo' }] });
    expect(result.flaggedPatterns).toEqual([
      { patternId: 'photo-alt', ruleId: 'list', kind: 'violation' },
    ]);
  });

  it('flags a pattern inside an unexpected container violation', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<ul class="extra"><a class="link" href="/">x</a></ul>',
    );
    const { result } = run({
      patterns: [...patterns, { id: 'link', selector: '.link' }],
      violations: [...healthy, { ruleId: 'list', target: ['.extra'] }],
    });
    expect(result.flaggedPatterns).toEqual([
      { patternId: 'link', ruleId: 'list', kind: 'violation' },
    ]);
  });
});

describe('SampleSiteManifest', () => {
  const manifest = JSON.parse(
    // A path, not a URL: jsdom replaces the global URL, which fs rejects.
    readFileSync(resolve(import.meta.dirname, '../../sample-site/issues.manifest.json'), 'utf8'),
  ) as { correctPatterns: { insideIssues?: string[] }[] };

  it('parses the real manifest', () => {
    expect(SampleSiteManifest.safeParse(manifest).success).toBe(true);
  });

  it('rejects insideIssues that name an unknown issue', () => {
    const bad = structuredClone(manifest);
    bad.correctPatterns[0]!.insideIssues = ['no-such-issue'];
    expect(SampleSiteManifest.safeParse(bad).success).toBe(false);
  });
});
