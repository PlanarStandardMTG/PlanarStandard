import type { RunStructure } from "@ps/contracts";

/**
 * MTR Appendix E's constructed column: the fewest entrants for each row, and its
 * Swiss rounds and top cut. Below 9, Appendix E would run straight single elimination;
 * Planar Standard's suggestion is three Swiss rounds and no cut, so everyone plays three
 * matches (§28).
 */
const ROWS: ReadonlyArray<readonly [minEntrants: number, swissRounds: number, topCut: number]> = [
  [410, 10, 8],
  [227, 9, 8],
  [129, 8, 8],
  [65, 7, 8],
  [33, 6, 8],
  [17, 5, 8],
  [9, 5, 4],
  [3, 3, 0],
  [2, 1, 0],
];

/**
 * A structure to prefill for `entrants` players. Only a suggestion: the organizer may set
 * any value, and the rest of the flow does the best the rules allow with it.
 */
export function suggestRounds(entrants: number): RunStructure {
  const row = ROWS.find(([min]) => entrants >= min);
  return row === undefined
    ? { swissRounds: 0, topCut: 0 }
    : { swissRounds: row[1], topCut: row[2] };
}
