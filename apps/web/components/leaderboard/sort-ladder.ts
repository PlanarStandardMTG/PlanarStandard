import type { LeaderboardRow, UnrankedPlayerRow } from "@ps/contracts";

/** `rank` is the place on the whole ladder, so a filtered page keeps it. */
export type LadderRow =
  | { readonly rank: number; readonly row: LeaderboardRow }
  | { readonly rank: null; readonly row: UnrankedPlayerRow };

export type LadderColumn = "rank" | "player" | "rating" | "record" | "matches" | "events" | "peak";
export type SortDirection = "asc" | "desc";

export interface LadderSort {
  readonly column: LadderColumn;
  readonly direction: SortDirection;
}

export const LADDER_ORDER: LadderSort = { column: "rank", direction: "asc" };

export function isLadderOrder(sort: LadderSort): boolean {
  return sort.column === LADDER_ORDER.column && sort.direction === LADDER_ORDER.direction;
}

const COLUMNS: readonly LadderColumn[] = [
  "rank",
  "player",
  "rating",
  "record",
  "matches",
  "events",
  "peak",
];

/** Names read A–Z first, ranks 1 first; every count reads biggest first. */
export function firstDirection(column: LadderColumn): SortDirection {
  return column === "rank" || column === "player" ? "asc" : "desc";
}

/** `?sort=peak&dir=asc`; anything unrecognised is the ladder's own order. */
export function readLadderSort(sort: unknown, dir: unknown): LadderSort {
  const column = COLUMNS.find((c) => c === sort);
  if (column === undefined) return LADDER_ORDER;
  return { column, direction: dir === "asc" || dir === "desc" ? dir : firstDirection(column) };
}

/** What a heading links to: its own first direction, or the other way when it already sorts. */
export function nextSort(current: LadderSort, column: LadderColumn): LadderSort {
  if (current.column !== column) return { column, direction: firstDirection(column) };
  return { column, direction: current.direction === "asc" ? "desc" : "asc" };
}

/**
 * Reorders the rows without touching their ranks — a ranked player keeps the place they hold on
 * the ladder whatever the table is sorted by. Unranked players have no numbers to sort, so they
 * stay after the ranked ones as they came, except when the table is sorted by name.
 */
export function sortLadder(rows: readonly LadderRow[], sort: LadderSort): LadderRow[] {
  if (isLadderOrder(sort)) return [...rows];
  const sign = sort.direction === "asc" ? 1 : -1;
  if (sort.column === "player") {
    return [...rows].sort((a, b) => sign * a.row.displayName.localeCompare(b.row.displayName));
  }
  const ranked = rows.filter(isRanked);
  const unranked = rows.filter((entry) => entry.rank === null);
  const key = KEYS[sort.column];
  ranked.sort((a, b) => sign * compareKeys(key(a), key(b)) || a.rank - b.rank);
  return [...ranked, ...unranked];
}

type RankedRow = Extract<LadderRow, { rank: number }>;

function isRanked(entry: LadderRow): entry is RankedRow {
  return entry.rank !== null;
}

const KEYS: Record<Exclude<LadderColumn, "player">, (entry: RankedRow) => readonly number[]> = {
  rank: (entry) => [entry.rank],
  rating: ({ row }) => [row.rating],
  // More wins first, then fewer losses: a record, never a rate.
  record: ({ row }) => [row.wins, -row.losses],
  matches: ({ row }) => [row.matchesPlayed],
  events: ({ row }) => [row.tournamentsPlayed],
  peak: ({ row }) => [row.peakRating],
};

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
