import type { RunPairing, RunResultStatus } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { isCounted, runRecords } from "./index";

let next = 0;
function played(
  p1: string,
  p2: string,
  [p1Wins, p2Wins, draws]: [number, number, number],
  status: RunResultStatus = "confirmed",
): RunPairing {
  next += 1;
  return {
    id: `p${next}`,
    roundId: `r${next}`,
    round: next,
    table: 1,
    p1EntrantId: p1,
    p2EntrantId: p2,
    games: { p1Wins, p2Wins, draws },
    status,
  };
}

function bye(p1: string): RunPairing {
  next += 1;
  return {
    id: `p${next}`,
    roundId: `r${next}`,
    round: next,
    table: 9,
    p1EntrantId: p1,
    p2EntrantId: null,
    games: null,
    status: "confirmed",
  };
}

describe("core/runs/record", () => {
  it("scores match points 3/1/0 (MTR Appendix C)", () => {
    const sixAndTwo = [
      ...Array.from({ length: 6 }, () => played("a", "x", [2, 0, 0])),
      ...Array.from({ length: 2 }, () => played("a", "x", [0, 2, 0])),
    ];
    const fourTwoTwo = [
      ...Array.from({ length: 4 }, () => played("b", "x", [2, 1, 0])),
      ...Array.from({ length: 2 }, () => played("b", "x", [1, 2, 0])),
      ...Array.from({ length: 2 }, () => played("b", "x", [1, 1, 1])),
    ];
    const records = runRecords(["a", "b"], [...sixAndTwo, ...fourTwoTwo]);

    expect(records.get("a")).toMatchObject({ wins: 6, losses: 2, draws: 0, matchPoints: 18 });
    expect(records.get("b")).toMatchObject({ wins: 4, losses: 2, draws: 2, matchPoints: 14 });
  });

  it("scores game points 3/1/0 for each side (MTR Appendix C)", () => {
    const records = runRecords(
      ["a", "b", "c", "d", "e", "f"],
      [played("a", "b", [2, 0, 0]), played("c", "d", [2, 1, 0]), played("e", "f", [2, 0, 1])],
    );

    expect([records.get("a")?.gamePoints, records.get("b")?.gamePoints]).toEqual([6, 0]);
    expect([records.get("c")?.gamePoints, records.get("d")?.gamePoints]).toEqual([6, 3]);
    expect([records.get("e")?.gamePoints, records.get("f")?.gamePoints]).toEqual([7, 1]);
    expect(records.get("e")?.gamesPlayed).toBe(3);
  });

  it("counts a bye as a 2–0 win: 3 match points and 6 game points", () => {
    const records = runRecords(["a"], [bye("a")]);

    expect(records.get("a")).toEqual({
      entrantId: "a",
      matchPoints: 3,
      wins: 1,
      losses: 0,
      draws: 0,
      byes: 1,
      roundsPlayed: 1,
      gamePoints: 6,
      gamesPlayed: 2,
    });
  });

  it("gives an intentional draw reported 0–0–3 one match point and 3 of 9 game points each", () => {
    const records = runRecords(["a", "b"], [played("a", "b", [0, 0, 3])]);

    for (const id of ["a", "b"]) {
      expect(records.get(id)).toMatchObject({
        draws: 1,
        matchPoints: 1,
        gamePoints: 3,
        gamesPlayed: 3,
      });
    }
  });

  it("scores a concession by a player who won a game as 2–1 (MTR §2.5)", () => {
    const records = runRecords(["a", "b"], [played("a", "b", [1, 2, 0])]);

    expect(records.get("a")).toMatchObject({ losses: 1, gamePoints: 3 });
    expect(records.get("b")).toMatchObject({ wins: 1, gamePoints: 6 });
  });

  it("does not count a result nobody has confirmed, or one not yet reported", () => {
    const reported = played("a", "b", [2, 0, 0], "reported");
    const pending: RunPairing = { ...played("a", "c", [0, 0, 0], "pending"), games: null };

    expect(isCounted(reported)).toBe(false);
    expect(isCounted(pending)).toBe(false);
    expect(runRecords(["a", "b", "c"], [reported, pending]).get("a")).toMatchObject({
      matchPoints: 0,
      roundsPlayed: 0,
    });
  });

  it("gives every listed entrant a record, even one who has not played", () => {
    expect(runRecords(["idle"], []).get("idle")?.matchPoints).toBe(0);
  });
});
