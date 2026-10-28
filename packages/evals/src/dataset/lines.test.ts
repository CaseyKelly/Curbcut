import { describe, expect, it } from 'vitest';
import { changesOutside, sameLines, splitLines } from './lines';

const before = 'a\nb\nc\nd\n';
const ranges = [{ start: 2, end: 3 }];

describe('splitLines and sameLines', () => {
  it('ignores line endings and a trailing newline', () => {
    expect(splitLines('x\r\ny\r\n')).toEqual(['x', 'y']);
    expect(sameLines('x\r\ny\r\n', 'x\ny')).toBe(true);
    expect(sameLines('x\ny\n', 'x\nz\n')).toBe(false);
  });
});

describe('changesOutside', () => {
  it('finds nothing when the files match', () => {
    expect(changesOutside(before, before, [])).toEqual([]);
  });

  it('accepts changes inside the ranges', () => {
    expect(changesOutside(before, 'a\nB\nC\nd\n', ranges)).toEqual([]);
  });

  it('accepts an insertion next to an allowed line', () => {
    expect(changesOutside(before, 'a\nx\nb\nc\ny\nd\n', ranges)).toEqual([]);
  });

  it('reports a replaced line once, not also as an insertion', () => {
    expect(changesOutside(before, 'A\nb\nc\nd\n', ranges)).toEqual(['changes line 1']);
  });

  it('reports removals and insertions away from the ranges', () => {
    expect(changesOutside('a\nb\nc\nd\ne\nf\n', 'b\nc\nd\ne\nf\ny\n', ranges)).toEqual([
      'changes line 1',
      'adds lines after line 6',
    ]);
  });

  it('ignores a change of line endings', () => {
    expect(changesOutside('x\r\ny\r\n', 'x\ny\n', [{ start: 1, end: 1 }])).toEqual([]);
  });

  it('pins a deletion to the copy of a repeated line that keeps it in scope', () => {
    // Deleting lines 1-2 leaves the same text as deleting lines 2-3.
    expect(changesOutside('C\nQ\nC\n', 'C\n', [{ start: 1, end: 2 }])).toEqual([]);
    expect(changesOutside('C\nQ\nC\n', 'C\n', [{ start: 2, end: 3 }])).toEqual([]);
    // In JSX: removing a wrapper whose closing tag repeats further down.
    const jsx = '<div>\n<div>\n<img />\n</div>\n</div>\n';
    expect(changesOutside(jsx, '<div>\n<img />\n</div>\n', [{ start: 2, end: 4 }])).toEqual([]);
  });

  it('still fails an edit that no alignment keeps in scope', () => {
    expect(changesOutside('C\nQ\nC\n', 'Q\n', [{ start: 1, end: 1 }])).toEqual(['changes line 3']);
  });

  it('agrees with an untrimmed search on random edits', () => {
    // Brute force: every subset of lines to keep, against the same rules.
    const allowed = (rs: { start: number; end: number }[], l: number) =>
      rs.some((r) => l >= r.start && l <= r.end);
    const bestCost = (a: string[], b: string[], rs: { start: number; end: number }[]) => {
      const memo = new Map<string, number>();
      const go = (i: number, j: number): number => {
        const key = `${i},${j}`;
        const hit = memo.get(key);
        if (hit !== undefined) return hit;
        let best = Infinity;
        if (i === a.length && j === b.length) best = 0;
        if (i < a.length && j < b.length && a[i] === b[j]) best = go(i + 1, j + 1);
        if (i < a.length) best = Math.min(best, (allowed(rs, i + 1) ? 0 : 1) + go(i + 1, j));
        if (j < b.length) {
          best = Math.min(best, (allowed(rs, i) || allowed(rs, i + 1) ? 0 : 1) + go(i, j + 1));
        }
        memo.set(key, best);
        return best;
      };
      return go(0, 0);
    };
    let seed = 7;
    const rand = (k: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % k;
    };
    for (let t = 0; t < 500; t++) {
      const a = Array.from({ length: 2 + rand(7) }, () => 'xyz'[rand(3)]!);
      const b = Array.from({ length: rand(8) }, () => 'xyz'[rand(3)]!);
      const start = 1 + rand(a.length);
      const rs = [{ start, end: start + rand(a.length - start + 1) }];
      const inScope = changesOutside(a.join('\n'), b.join('\n'), rs).length === 0;
      expect(inScope, `${a.join('')} -> ${b.join('')} in ${start}-${rs[0]!.end}`).toBe(
        bestCost(a, b, rs) === 0,
      );
    }
  });
});
