import { describe, expect, it } from 'vitest';
import { changedLines, changesOutside } from './lines';

const before = 'a\nb\nc\nd\n';

describe('changedLines', () => {
  it('finds nothing when the files match', () => {
    expect(changedLines(before, before)).toEqual({ removed: [], insertedAfter: [] });
  });

  it('reports a replaced line as removed, with its replacement inserted beside it', () => {
    const changes = changedLines(before, 'a\nB\nc\nd\n');
    expect(changes.removed).toEqual([2]);
    expect(changes.insertedAfter).toHaveLength(1);
    expect([1, 2]).toContain(changes.insertedAfter[0]);
  });

  it('reports pure insertions and deletions', () => {
    expect(changedLines(before, 'x\na\nb\nc\nd\n')).toEqual({ removed: [], insertedAfter: [0] });
    expect(changedLines(before, 'a\nb\nc\nd\ny\n')).toEqual({ removed: [], insertedAfter: [4] });
    expect(changedLines(before, 'a\nd\n')).toEqual({ removed: [2, 3], insertedAfter: [] });
  });

  it('ignores whether the file ends with a newline', () => {
    expect(changedLines(before, 'a\nb\nc\nd')).toEqual({ removed: [], insertedAfter: [] });
  });
});

describe('changesOutside', () => {
  const ranges = [{ start: 2, end: 3 }];

  it('accepts changes inside the ranges', () => {
    expect(changesOutside(changedLines(before, 'a\nB\nC\nd\n'), ranges)).toEqual([]);
  });

  it('accepts an insertion next to an allowed line', () => {
    expect(changesOutside({ removed: [], insertedAfter: [1, 3] }, ranges)).toEqual([]);
  });

  it('reports a replaced line once, not also as an insertion', () => {
    expect(changesOutside(changedLines(before, 'A\nb\nc\nd\n'), ranges)).toEqual([
      'changes line 1',
    ]);
  });

  it('reports changes and insertions away from the ranges', () => {
    expect(changesOutside({ removed: [1, 2], insertedAfter: [4] }, ranges)).toEqual([
      'changes line 1',
      'adds lines after line 4',
    ]);
  });
});
