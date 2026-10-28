// Whether an edit stays within a file's allowed lines. The dataset validator
// uses it to check reference fixes against allowedLines, and scorer (c) will
// use it to check the agent's patches (#13).
import type { LineRange } from '@curbcut/core';

/** Lines of a file, ignoring CRLF vs LF and a trailing newline. */
export const splitLines = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

/** Whether two files have the same lines, ignoring line endings. */
export const sameLines = (a: string, b: string): boolean =>
  splitLines(a).join('\n') === splitLines(b).join('\n');

/**
 * The changes from `before` to `after` that fall outside `ranges`, as
 * human-readable descriptions; empty when the edit is in scope.
 *
 * A line-level diff is ambiguous when lines repeat (`</div>` often does), so
 * this picks the alignment with the fewest out-of-scope changes rather than
 * the first one found. A correct patch is never failed because the diff
 * pinned its deletion to a different copy of a line.
 *
 * Removing or replacing line l is in scope when l is in a range. Adding lines
 * after line k (0 is the top) is in scope when line k or k+1 is, so adding a
 * `<label>` just above an allowed `<input>` counts. Lines added beside a
 * removed line are its replacement, so only the removed line is reported.
 */
export function changesOutside(
  before: string,
  after: string,
  ranges: readonly LineRange[],
): string[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const allowed = (line: number) => ranges.some((r) => line >= r.start && line <= r.end);
  // Line l can be matched as-is without losing a cheaper alignment when no
  // edit near it is free: neither it nor its neighbours are allowed.
  const fixed = (line: number) => !allowed(line - 1) && !allowed(line) && !allowed(line + 1);

  // Skip lines both files share at the top and bottom, so the table below
  // only covers the changed region.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head] && fixed(head + 1)) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail] &&
    fixed(a.length - tail)
  ) {
    tail++;
  }
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  /** 1-based line number in `before` of row i of the table. */
  const lineOf = (i: number) => head + i + 1;
  const delCost = (i: number) => (allowed(lineOf(i)) ? 0 : 1);
  // Inserting before row i means after line lineOf(i) - 1.
  const insCost = (i: number) => (allowed(lineOf(i) - 1) || allowed(lineOf(i)) ? 0 : 1);

  // cost[i][j]: fewest out-of-scope changes to turn a[i..] into b[j..].
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n && j === m) continue;
      let best = Infinity;
      if (i < n && j < m && a[head + i] === b[head + j]) best = cost[i + 1]![j + 1]!;
      if (i < n) best = Math.min(best, delCost(i) + cost[i + 1]![j]!);
      if (j < m) best = Math.min(best, insCost(i) + cost[i]![j + 1]!);
      cost[i]![j] = best;
    }
  }

  // Walk one cheapest alignment, preferring a match, then a removal.
  const removed: number[] = [];
  const insertedAfter = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const here = cost[i]![j]!;
    if (i < n && j < m && a[head + i] === b[head + j] && cost[i + 1]![j + 1] === here) {
      i++;
      j++;
    } else if (i < n && delCost(i) + cost[i + 1]![j]! === here) {
      removed.push(lineOf(i));
      i++;
    } else {
      insertedAfter.add(lineOf(i) - 1);
      j++;
    }
  }
  const removedSet = new Set(removed);
  return [
    ...removed.filter((l) => !allowed(l)).map((l) => `changes line ${l}`),
    ...[...insertedAfter]
      .filter((k) => !removedSet.has(k) && !removedSet.has(k + 1))
      .filter((k) => !allowed(k) && !allowed(k + 1))
      .map((k) => `adds lines after line ${k}`),
  ];
}
