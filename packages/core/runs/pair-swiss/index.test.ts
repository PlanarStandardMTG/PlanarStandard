import type { ProposedRunPairing, RunEntrant, RunPairing } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { seededRandom } from "../seeded-random/index";
import { pairSwiss } from "./index";

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

const field = (n: number): RunEntrant[] =>
  Array.from({ length: n }, (_, i) => entrant(`e${String(i + 1).padStart(2, "0")}`));

/** Posts proposed pairings as confirmed results, the winner drawn from `random`. */
function post(
  proposed: readonly ProposedRunPairing[],
  round: number,
  random: () => number,
): RunPairing[] {
  return proposed.map((p) => {
    const roll = random();
    const games =
      p.p2EntrantId === null
        ? null
        : roll < 0.45
          ? { p1Wins: 2, p2Wins: roll < 0.2 ? 0 : 1, draws: 0 }
          : roll < 0.9
            ? { p1Wins: roll < 0.7 ? 0 : 1, p2Wins: 2, draws: 0 }
            : { p1Wins: 0, p2Wins: 0, draws: 3 };
    return {
      id: `r${round}t${p.table}`,
      roundId: `r${round}`,
      round,
      table: p.table,
      p1EntrantId: p.p1EntrantId,
      p2EntrantId: p.p2EntrantId,
      games,
      status: "confirmed",
    };
  });
}

const key = (a: string, b: string) => [a, b].sort().join("|");

describe("core/runs/pair-swiss", () => {
  it("pairs round 1 at random from the seed, the same way every time", () => {
    const entrants = field(8);
    const first = pairSwiss({ entrants, pairings: [], seed: "run-1", round: 1 });
    const again = pairSwiss({ entrants, pairings: [], seed: "run-1", round: 1 });
    const other = pairSwiss({ entrants, pairings: [], seed: "run-2", round: 1 });

    expect(first).toEqual(again);
    expect(first).not.toEqual(other);
    expect(first.ok && first.pairings.map((p) => p.table)).toEqual([1, 2, 3, 4]);
  });

  it("pairs within point groups, top down", () => {
    const entrants = field(8);
    const round1 = pairSwiss({ entrants, pairings: [], seed: "s", round: 1 });
    if (!round1.ok) throw new Error("round 1");
    const results = round1.pairings.map((p) => ({
      ...p,
      id: `t${p.table}`,
      roundId: "r1",
      round: 1,
      games: { p1Wins: 2, p2Wins: 0, draws: 0 },
      status: "confirmed" as const,
    }));
    const winners = new Set(results.map((p) => p.p1EntrantId));

    const round2 = pairSwiss({ entrants, pairings: results, seed: "s", round: 2 });
    if (!round2.ok) throw new Error("round 2");
    for (const p of round2.pairings) {
      expect(winners.has(p.p1EntrantId)).toBe(winners.has(p.p2EntrantId ?? ""));
    }
    expect(winners.has(round2.pairings[0]?.p1EntrantId ?? "")).toBe(true);
  });

  it("pairs down from an odd point group", () => {
    // a and c won, e and f drew: two 3-pointers, two 1-pointers, two on 0.
    const entrants = ["a", "b", "c", "d", "e", "f"].map((id) => entrant(id));
    const r1: RunPairing[] = [
      {
        id: "1",
        roundId: "r1",
        round: 1,
        table: 1,
        p1EntrantId: "a",
        p2EntrantId: "b",
        games: { p1Wins: 2, p2Wins: 0, draws: 0 },
        status: "confirmed",
      },
      {
        id: "2",
        roundId: "r1",
        round: 1,
        table: 2,
        p1EntrantId: "c",
        p2EntrantId: "d",
        games: { p1Wins: 2, p2Wins: 0, draws: 0 },
        status: "confirmed",
      },
      {
        id: "3",
        roundId: "r1",
        round: 1,
        table: 3,
        p1EntrantId: "e",
        p2EntrantId: "f",
        games: { p1Wins: 1, p2Wins: 1, draws: 1 },
        status: "confirmed",
      },
    ];
    const result = pairSwiss({ entrants, pairings: r1, seed: "s", round: 2 });
    if (!result.ok) throw new Error("round 2");

    // a and c pair; e and f (1 point each) cannot rematch, so each pairs with a 0-pointer.
    expect(key(result.pairings[0]?.p1EntrantId ?? "", result.pairings[0]?.p2EntrantId ?? "")).toBe(
      "a|c",
    );
    const rest = result.pairings.slice(1).map((p) => key(p.p1EntrantId, p.p2EntrantId ?? ""));
    expect(rest).not.toContain("e|f");
    expect(rest.every((k) => /[ef]/.test(k) && /[bd]/.test(k))).toBe(true);
  });

  it("gives the bye to the lowest-ranked player without one, on the last table", () => {
    const entrants = field(5);
    const round1 = pairSwiss({ entrants, pairings: [], seed: "s", round: 1 });
    if (!round1.ok) throw new Error("round 1");
    const bye = round1.pairings.at(-1);
    expect(bye).toMatchObject({ table: 3, p2EntrantId: null });

    const round2 = pairSwiss({
      entrants,
      pairings: post(round1.pairings, 1, seededRandom("results")),
      seed: "s",
      round: 2,
    });
    if (!round2.ok) throw new Error("round 2");
    expect(round2.pairings.at(-1)?.p1EntrantId).not.toBe(bye?.p1EntrantId);
  });

  it("does not pair anyone who dropped before the round, or was never checked in", () => {
    const entrants = [
      ...field(4),
      entrant("gone", { droppedAfterRound: 1 }),
      entrant("absent", { checkedIn: false }),
    ];
    const result = pairSwiss({ entrants, pairings: [], seed: "s", round: 2 });
    if (!result.ok) throw new Error("round 2");
    const ids = result.pairings.flatMap((p) => [p.p1EntrantId, p.p2EntrantId]);
    expect(ids).not.toContain("gone");
    expect(ids).not.toContain("absent");
    expect(result.pairings).toHaveLength(2);
  });

  it("says so when no pairing avoids a rematch, rather than returning one", () => {
    const entrants = field(4);
    let pairings: RunPairing[] = [];
    for (let round = 1; round <= 3; round += 1) {
      const result = pairSwiss({ entrants, pairings, seed: "rr", round });
      if (!result.ok) throw new Error(`round ${round}`);
      pairings = [...pairings, ...post(result.pairings, round, seededRandom(`res${round}`))];
    }

    expect(pairSwiss({ entrants, pairings, seed: "rr", round: 4 })).toEqual({
      ok: false,
      reason: "no-pairing-without-rematch",
    });
  });

  it("needs two players", () => {
    expect(pairSwiss({ entrants: field(1), pairings: [], seed: "s", round: 1 })).toEqual({
      ok: false,
      reason: "too-few-entrants",
    });
  });

  it("over random runs: no rematch, nobody paired twice, everyone paired, reproducible", () => {
    const draw = seededRandom("property");
    for (let trial = 0; trial < 150; trial += 1) {
      const size = 2 + Math.floor(draw() * 31);
      let entrants = field(size);
      const rounds = 1 + Math.floor(draw() * 7);
      const seed = `trial-${trial}`;
      let pairings: RunPairing[] = [];

      for (let round = 1; round <= rounds; round += 1) {
        // Now and then someone drops before this round is paired.
        if (draw() < 0.2) {
          const victim = Math.floor(draw() * entrants.length);
          entrants = entrants.map((e, i) =>
            i === victim && e.droppedAfterRound === null
              ? { ...e, droppedAfterRound: round - 1 }
              : e,
          );
        }
        const input = { entrants, pairings, seed, round };
        const result = pairSwiss(input);
        expect(pairSwiss(input)).toEqual(result);
        if (!result.ok) break;

        const ids = result.pairings.flatMap((p) =>
          p.p2EntrantId === null ? [p.p1EntrantId] : [p.p1EntrantId, p.p2EntrantId],
        );
        const active = entrants.filter(
          (e) => e.droppedAfterRound === null || e.droppedAfterRound >= round,
        );
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(ids)).toEqual(new Set(active.map((e) => e.id)));
        expect(result.pairings.filter((p) => p.p2EntrantId === null).length).toBe(
          active.length % 2,
        );

        const before = new Set(
          pairings.flatMap((p) =>
            p.p2EntrantId === null ? [] : [key(p.p1EntrantId, p.p2EntrantId)],
          ),
        );
        for (const p of result.pairings) {
          if (p.p2EntrantId !== null)
            expect(before.has(key(p.p1EntrantId, p.p2EntrantId))).toBe(false);
        }
        pairings = [...pairings, ...post(result.pairings, round, draw)];
      }
    }
  });
});
