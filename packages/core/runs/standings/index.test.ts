import type { RunEntrant, RunPairing } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { runStandings } from "./index";

function entrant(id: string, extra: Partial<RunEntrant> = {}): RunEntrant {
  return {
    id,
    runId: "run",
    profileId: null,
    displayName: id,
    handle: id,
    checkedIn: true,
    droppedAfterRound: null,
    ...extra,
  };
}

let next = 0;
function played(
  round: number,
  p1: string,
  p2: string,
  [w, l, d]: [number, number, number],
): RunPairing {
  next += 1;
  return {
    id: `p${next}`,
    roundId: `r${round}`,
    round,
    table: next,
    p1EntrantId: p1,
    p2EntrantId: p2,
    games: { p1Wins: w, p2Wins: l, draws: d },
    status: "confirmed",
  };
}

const order = (standings: ReturnType<typeof runStandings>) => standings.map((s) => s.entrantId);

describe("core/runs/standings", () => {
  it("ranks by match points first", () => {
    const standings = runStandings({
      entrants: ["a", "b", "c", "d"].map((id) => entrant(id)),
      pairings: [
        played(1, "a", "b", [2, 0, 0]),
        played(1, "c", "d", [1, 1, 1]),
        played(2, "a", "c", [2, 1, 0]),
        played(2, "b", "d", [2, 0, 0]),
      ],
      seed: "s",
    });

    expect(order(standings)[0]).toBe("a");
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
    expect(standings[0]).toMatchObject({ matchPoints: 6, wins: 2 });
  });

  it("breaks equal match points by opponents' match-win %, then game-win %, then opponents' game-win %", () => {
    // a and b are both 1–1. a lost to the 2–0 player, b lost to a 1–1, so a's opponents did better.
    const omw = runStandings({
      entrants: ["a", "b", "c", "d"].map((id) => entrant(id)),
      pairings: [
        played(1, "c", "a", [2, 0, 0]),
        played(1, "b", "d", [2, 0, 0]),
        played(2, "a", "d", [2, 0, 0]),
        played(2, "c", "b", [2, 0, 0]),
      ],
      seed: "s",
    });
    expect(order(omw)).toEqual(["c", "a", "b", "d"]);

    // Same opponents' records; a dropped a game where b did not.
    const gw = runStandings({
      entrants: ["a", "b", "c", "d"].map((id) => entrant(id)),
      pairings: [played(1, "a", "c", [2, 1, 0]), played(1, "b", "d", [2, 0, 0])],
      seed: "s",
    });
    expect(order(gw).slice(0, 2)).toEqual(["b", "a"]);

    // a and b both won 2–1 against a 1–3 opponent, so match points, opponents' match-win
    // (floored) and game-win all tie. c took 15 of 33 game points, d 15 of 36.
    const ogw = runStandings({
      entrants: ["a", "b"].map((id) => entrant(id)),
      pairings: [
        played(1, "a", "c", [2, 1, 0]),
        played(1, "b", "d", [2, 1, 0]),
        played(2, "c", "x", [2, 0, 0]),
        played(2, "d", "u", [2, 1, 0]),
        played(3, "c", "y", [1, 2, 0]),
        played(3, "d", "v", [1, 2, 0]),
        played(4, "c", "z", [1, 2, 0]),
        played(4, "d", "w", [1, 2, 0]),
      ],
      seed: "s",
    });
    expect(ogw.map((s) => s.opponentMatchWinPct)).toEqual([0.33, 0.33]);
    expect(order(ogw)).toEqual(["a", "b"]);
    expect(ogw[0]?.opponentGameWinPct).toBeCloseTo(15 / 33, 12);
  });

  it("keeps a dropped entrant in their place, marked as dropped", () => {
    const standings = runStandings({
      entrants: [entrant("a", { droppedAfterRound: 1 }), entrant("b")],
      pairings: [played(1, "a", "b", [2, 0, 0])],
      seed: "s",
    });

    expect(order(standings)).toEqual(["a", "b"]);
    expect(standings[0]?.dropped).toBe(true);
  });

  it("leaves out an entrant who dropped before round 1, and one never checked in", () => {
    const standings = runStandings({
      entrants: [
        entrant("a"),
        entrant("b"),
        entrant("early", { droppedAfterRound: 0 }),
        entrant("absent", { checkedIn: false }),
      ],
      pairings: [played(1, "a", "b", [2, 0, 0])],
      seed: "s",
    });

    expect(order(standings)).toEqual(["a", "b"]);
  });

  it("shows the standings as they stood after an earlier round", () => {
    const pairings = [
      played(1, "a", "b", [2, 0, 0]),
      played(1, "c", "d", [2, 0, 0]),
      played(2, "b", "a", [2, 0, 0]),
      played(2, "d", "c", [2, 1, 0]),
    ];
    const entrants = [
      entrant("a"),
      entrant("b", { droppedAfterRound: 2 }),
      entrant("c"),
      entrant("d"),
    ];
    const afterOne = runStandings({ entrants, pairings, seed: "s", throughRound: 1 });

    expect(afterOne.find((s) => s.entrantId === "a")).toMatchObject({
      matchPoints: 3,
      roundsPlayed: 1,
    });
    expect(afterOne.find((s) => s.entrantId === "b")).toMatchObject({
      matchPoints: 0,
      dropped: false,
    });
    expect(
      runStandings({ entrants, pairings, seed: "s" }).find((s) => s.entrantId === "b"),
    ).toMatchObject({
      matchPoints: 3,
      dropped: true,
    });
  });

  it("breaks an exact tie by the seed, the same way on every read", () => {
    const entrants = ["a", "b", "c", "d", "e", "f"].map((id) => entrant(id));
    const read = (seed: string) => order(runStandings({ entrants, pairings: [], seed }));

    expect(read("run-7")).toEqual(read("run-7"));
    const orders = new Set(
      ["run-1", "run-2", "run-3", "run-4", "run-5"].map((s) => read(s).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});
