import type { LeaderboardRow, PlayerId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { LADDER_ORDER, type LadderRow, nextSort, readLadderSort, sortLadder } from "./sort-ladder";

function ranked(rank: number, name: string, stats: Partial<LeaderboardRow> = {}): LadderRow {
  return {
    rank,
    row: {
      id: name as PlayerId,
      slug: name,
      displayName: name,
      rating: 1500,
      peakRating: 1500,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tournamentsPlayed: 0,
      lastPlayed: null,
      ...stats,
    },
  };
}

function unranked(name: string): LadderRow {
  return {
    rank: null,
    row: { id: name as PlayerId, slug: name, displayName: name, lastPlayed: "2026-08-01" },
  };
}

const LADDER = [
  ranked(1, "Cass", { rating: 1620, peakRating: 1640, wins: 6, losses: 1, matchesPlayed: 7 }),
  ranked(2, "Bo", { rating: 1580, peakRating: 1700, wins: 6, losses: 3, matchesPlayed: 9 }),
  ranked(3, "Ari", { rating: 1540, peakRating: 1560, wins: 7, losses: 4, matchesPlayed: 11 }),
  ranked(4, "Dee", { rating: 1510, peakRating: 1700, wins: 2, losses: 2, matchesPlayed: 4 }),
  unranked("Abe"),
  unranked("Zed"),
];

const order = (rows: readonly LadderRow[]) => rows.map(({ rank, row }) => [rank, row.displayName]);

describe("sortLadder", () => {
  it("keeps the ladder's order by default", () => {
    expect(sortLadder(LADDER, LADDER_ORDER)).toEqual(LADDER);
  });

  it("reorders by a column and keeps every player's rank", () => {
    expect(order(sortLadder(LADDER, { column: "peak", direction: "desc" }))).toEqual([
      [2, "Bo"],
      [4, "Dee"],
      [1, "Cass"],
      [3, "Ari"],
      [null, "Abe"],
      [null, "Zed"],
    ]);
  });

  it("orders a record by wins, then by fewer losses", () => {
    expect(order(sortLadder(LADDER, { column: "record", direction: "desc" })).slice(0, 4)).toEqual([
      [3, "Ari"],
      [1, "Cass"],
      [2, "Bo"],
      [4, "Dee"],
    ]);
  });

  it("keeps unranked players after the ranked ones whichever way a number sorts", () => {
    const rows = sortLadder(LADDER, { column: "rating", direction: "asc" });
    expect(order(rows)).toEqual([
      [4, "Dee"],
      [3, "Ari"],
      [2, "Bo"],
      [1, "Cass"],
      [null, "Abe"],
      [null, "Zed"],
    ]);
  });

  it("sorts everyone together by name", () => {
    expect(order(sortLadder(LADDER, { column: "player", direction: "asc" }))).toEqual([
      [null, "Abe"],
      [3, "Ari"],
      [2, "Bo"],
      [1, "Cass"],
      [4, "Dee"],
      [null, "Zed"],
    ]);
  });
});

describe("readLadderSort", () => {
  it("falls back to the ladder for anything it doesn't know", () => {
    expect(readLadderSort(undefined, undefined)).toEqual(LADDER_ORDER);
    expect(readLadderSort("elo", "desc")).toEqual(LADDER_ORDER);
  });

  it("starts a column the way it reads best", () => {
    expect(readLadderSort("peak", undefined)).toEqual({ column: "peak", direction: "desc" });
    expect(readLadderSort("player", "sideways")).toEqual({ column: "player", direction: "asc" });
    expect(readLadderSort("peak", "asc")).toEqual({ column: "peak", direction: "asc" });
  });
});

describe("nextSort", () => {
  it("flips the column already sorting and starts any other afresh", () => {
    expect(nextSort({ column: "peak", direction: "desc" }, "peak")).toEqual({
      column: "peak",
      direction: "asc",
    });
    expect(nextSort({ column: "peak", direction: "asc" }, "rating")).toEqual({
      column: "rating",
      direction: "desc",
    });
  });
});
