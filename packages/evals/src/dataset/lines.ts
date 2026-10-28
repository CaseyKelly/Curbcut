// Which lines of a file an edit touches, by a line-level LCS diff. The
// dataset validator uses it to check reference fixes against allowedLines,
// and scorer (c) will use it to check the agent's patches (#13).
import type { LineRange } from '@curbcut/core';

export type LineChanges = {
  /** 1-based lines of `before` that were removed or replaced. */
  removed: number[];
  /** Positions where lines were added: k means after line k of `before` (0 is the top). */
  insertedAfter: number[];
};

export const splitLines = (text: string): string[] => {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

export function changedLines(before: string, after: string): LineChanges {
  const a = splitLines(before);
  const b = splitLines(after);
  // lcs[i][j]: length of the longest common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const removed: number[] = [];
  const insertedAfter = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      insertedAfter.add(i);
      j++;
    } else {
      removed.push(i + 1);
      i++;
    }
  }
  return { removed, insertedAfter: [...insertedAfter] };
}

/**
 * The changes that fall outside `ranges`, as human-readable descriptions. An
 * insertion counts as inside when a line on either side of it is allowed, so
 * adding a `<label>` just above an allowed `<input>` is in scope. An insertion
 * beside a removed line is that line's replacement, so only the line is judged.
 */
export function changesOutside(changes: LineChanges, ranges: readonly LineRange[]): string[] {
  const allowed = (line: number) => ranges.some((r) => line >= r.start && line <= r.end);
  const removed = new Set(changes.removed);
  return [
    ...changes.removed.filter((l) => !allowed(l)).map((l) => `changes line ${l}`),
    ...changes.insertedAfter
      .filter((k) => !removed.has(k) && !removed.has(k + 1))
      .filter((k) => !allowed(k) && !allowed(k + 1))
      .map((k) => `adds lines after line ${k}`),
  ];
}
