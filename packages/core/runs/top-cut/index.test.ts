import type { ProposedRunPairing, RunEntrant, RunPairing, RunStanding } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { runStandings } from "../standings/index";
import { bracketOrder, cutSeeds, nextCutRound } from "./index";

/** Seed `n` is entrant `sN`, so a failure reads as seeds. */
const seeds = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

function entrant(id: string, droppedAfterRound: number | null = null): RunEntrant {
  return {
    id,
    runId: "run",
    profileId: null,
    displayName: id,
    handle: id,
    checkedIn: true,
    droppedAfterRound,
  };
}

const tables = (pairings: readonly ProposedRunPairing[]) =>
  pairings.map((p) => [p.p1EntrantId, p.p2EntrantId]);

/** Posts a round with the better seed winning every match. */
function favouritesWin(proposed: readonly ProposedRunPairing[], round: number): RunPairing[] {
  return proposed.map((p) => ({
    id: `r${round}t${p.table}`,
    roundId: `r${round}`,
    round,
    table: p.table,
    p1EntrantId: p.p1EntrantId,
    p2EntrantId: p.p2EntrantId,
    games: p.p2EntrantId === null ? null : { p1Wins: 2, p2Wins: 1, draws: 0 },
    status: "confirmed",
  }));
}

function pairingsOf(result: ReturnType<typeof nextCutRound>): readonly ProposedRunPairing[] {
  if (result.kind !== "pairings") throw new Error(result.kind);
  return result.pairings;
}

describe("core/runs/top-cut", () => {
  it("orders a bracket so 1 v 8 and 4 v 5 meet in a semifinal (MTR §10.4)", () => {
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(2)).toEqual([1, 2]);
    expect(bracketOrder(5)).toHaveLength(8);
  });

  it("seeds a top 8: 1 v 8, 4 v 5, 2 v 7, 3 v 6", () => {
    const entrants = seeds(8).map((id) => entrant(id));
    const result = nextCutRound({ seeds: seeds(8), entrants, pairings: [], round: 6 });

    expect(tables(pairingsOf(result))).toEqual([
      ["s1", "s8"],
      ["s4", "s5"],
      ["s2", "s7"],
      ["s3", "s6"],
    ]);
  });

  it("seeds a top 4: 1 v 4, 2 v 3", () => {
    const entrants = seeds(4).map((id) => entrant(id));
    const result = nextCutRound({ seeds: seeds(4), entrants, pairings: [], round: 6 });

    expect(tables(pairingsOf(result))).toEqual([
      ["s1", "s4"],
      ["s2", "s3"],
    ]);
  });

  it("sends the winners of 1/8 and 4/5 to the same semifinal, then crowns a champion", () => {
    const entrants = seeds(8).map((id) => entrant(id));
    const quarters: RunPairing[] = favouritesWin(
      pairingsOf(nextCutRound({ seeds: seeds(8), entrants, pairings: [], round: 6 })),
      6,
    ).map((p) =>
      // Upsets: 5 beats 4, 7 beats 2.
      p.p1EntrantId === "s4" || p.p1EntrantId === "s2"
        ? { ...p, games: { p1Wins: 0, p2Wins: 2, draws: 0 } }
        : p,
    );

    const semis = pairingsOf(
      nextCutRound({ seeds: seeds(8), entrants, pairings: quarters, round: 7 }),
    );
    expect(tables(semis)).toEqual([
      ["s1", "s5"],
      ["s3", "s7"],
    ]);

    const afterSemis = [...quarters, ...favouritesWin(semis, 7)];
    const final = pairingsOf(
      nextCutRound({ seeds: seeds(8), entrants, pairings: afterSemis, round: 8 }),
    );
    expect(tables(final)).toEqual([["s1", "s3"]]);

    expect(
      nextCutRound({
        seeds: seeds(8),
        entrants,
        pairings: [...afterSemis, ...favouritesWin(final, 8)],
        round: 9,
      }),
    ).toEqual({ kind: "finished", champion: "s1" });
  });

  it("gives the top seeds byes in a cut that is not a power of two", () => {
    const entrants = seeds(6).map((id) => entrant(id));
    const first = pairingsOf(nextCutRound({ seeds: seeds(6), entrants, pairings: [], round: 4 }));

    expect(tables(first)).toEqual([
      ["s4", "s5"],
      ["s3", "s6"],
      ["s1", null],
      ["s2", null],
    ]);
    expect(first.map((p) => p.table)).toEqual([1, 2, 3, 4]);

    const second = pairingsOf(
      nextCutRound({ seeds: seeds(6), entrants, pairings: favouritesWin(first, 4), round: 5 }),
    );
    expect(tables(second)).toEqual([
      ["s1", "s4"],
      ["s2", "s3"],
    ]);
  });

  it("cuts to the whole field when the cut is larger than it", () => {
    const standings = runStandings({
      entrants: seeds(5).map((id) => entrant(id)),
      pairings: [],
      seed: "s",
    });
    const cut = cutSeeds(standings, 8);
    expect(cut).toHaveLength(5);

    const first = pairingsOf(
      nextCutRound({ seeds: cut, entrants: cut.map((id) => entrant(id)), pairings: [], round: 1 }),
    );
    expect(first.filter((p) => p.p2EntrantId === null).map((p) => p.p1EntrantId)).toEqual(
      cut.slice(0, 3),
    );
    expect(tables(first)[0]).toEqual([cut[3], cut[4]]);
  });

  it("takes the cut from the standings, passing over anyone who dropped", () => {
    const line = (entrantId: string, dropped = false) => ({ entrantId, dropped }) as RunStanding;
    expect(cutSeeds([line("a"), line("b", true), line("c"), line("d")], 2)).toEqual(["a", "c"]);
    expect(cutSeeds([line("a")], 0)).toEqual([]);
  });

  it("seeds from the run's seed when there were no Swiss rounds", () => {
    const entrants = seeds(8).map((id) => entrant(id));
    const order = (seed: string) => cutSeeds(runStandings({ entrants, pairings: [], seed }), 8);

    expect(order("run-1")).toEqual(order("run-1"));
    expect(order("run-1")).not.toEqual(order("run-2"));
  });

  it("replaces nobody who drops after the cut: the top seed gets the bye (MTR §2.10)", () => {
    // Seed 5 drops before the quarterfinals are paired.
    const entrants = seeds(8).map((id) => entrant(id, id === "s5" ? 5 : null));
    const quarters = pairingsOf(
      nextCutRound({ seeds: seeds(8), entrants, pairings: [], round: 6 }),
    );

    expect(tables(quarters)).toEqual([
      ["s2", "s7"],
      ["s3", "s6"],
      ["s4", "s8"],
      ["s1", null],
    ]);

    const semis = pairingsOf(
      nextCutRound({ seeds: seeds(8), entrants, pairings: favouritesWin(quarters, 6), round: 7 }),
    );
    expect(tables(semis)).toEqual([
      ["s1", "s4"],
      ["s2", "s3"],
    ]);
  });

  it("gives the bye straight to the top seed when it is their opponent who dropped", () => {
    const quarters = favouritesWin(
      pairingsOf(
        nextCutRound({
          seeds: seeds(8),
          entrants: seeds(8).map((id) => entrant(id)),
          pairings: [],
          round: 6,
        }),
      ),
      6,
    );
    // s4 won their quarterfinal, then dropped before the semis.
    const entrants = seeds(8).map((id) => entrant(id, id === "s4" ? 6 : null));
    const semis = pairingsOf(
      nextCutRound({ seeds: seeds(8), entrants, pairings: quarters, round: 7 }),
    );

    expect(tables(semis)).toEqual([
      ["s2", "s3"],
      ["s1", null],
    ]);
  });

  it("waits for every result, and treats a drawn cut match as not yet decided (MTR §2.4)", () => {
    const entrants = seeds(4).map((id) => entrant(id));
    const round = favouritesWin(
      pairingsOf(nextCutRound({ seeds: seeds(4), entrants, pairings: [], round: 1 })),
      1,
    );
    const unreported = round.map((p, i) =>
      i === 0 ? { ...p, games: null, status: "pending" as const } : p,
    );
    const drawn = round.map((p, i) =>
      i === 0 ? { ...p, games: { p1Wins: 1, p2Wins: 1, draws: 1 } } : p,
    );

    for (const pairings of [unreported, drawn]) {
      expect(nextCutRound({ seeds: seeds(4), entrants, pairings, round: 2 })).toEqual({
        kind: "results-missing",
      });
    }
  });
});
