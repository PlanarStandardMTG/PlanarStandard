import type { RunStanding } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { assignBye, byeCandidates } from "./index";

function line(entrantId: string, rank: number, byes = 0): RunStanding {
  return {
    entrantId,
    rank,
    byes,
    matchPoints: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    roundsPlayed: 0,
    gamePoints: 0,
    gamesPlayed: 0,
    opponentMatchWinPct: 0.33,
    gameWinPct: 0.33,
    opponentGameWinPct: 0.33,
    dropped: false,
  };
}

const standings = [line("a", 1), line("b", 2), line("c", 3, 1), line("d", 4)];
const everyone = new Set(["a", "b", "c", "d"]);

describe("core/runs/assign-bye", () => {
  it("gives the bye to the lowest-ranked entrant", () => {
    expect(assignBye(standings, everyone)).toBe("d");
  });

  it("passes over anyone who has had a bye", () => {
    expect(byeCandidates(standings, everyone)).toEqual(["d", "b", "a", "c"]);
    expect(assignBye(standings, new Set(["a", "b", "c"]))).toBe("b");
  });

  it("falls back to someone who has had one only when everyone has", () => {
    const allHadOne = standings.map((s) => ({ ...s, byes: 1 }));
    expect(assignBye(allHadOne, everyone)).toBe("d");
  });

  it("never gives it to a dropped entrant", () => {
    expect(assignBye(standings, new Set(["a", "b"]))).toBe("b");
    expect(assignBye(standings, new Set())).toBeNull();
  });
});
