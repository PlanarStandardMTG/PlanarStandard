import type { ProposedRunPairing, RunEntrant, RunPairing, RunRound } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { pairSwiss } from "../pair-swiss/index";
import { runStandings } from "../standings/index";
import { cutSeeds, nextCutRound } from "../top-cut/index";
import { runEntrantHandle, toParsedEvent } from "./index";
import type { FinishedRun } from "./index";

function entrant(id: string, extra: Partial<RunEntrant> = {}): RunEntrant {
  return {
    id,
    runId: "run",
    profileId: `profile-${id}`,
    displayName: id.toUpperCase(),
    handle: id,
    checkedIn: true,
    droppedAfterRound: null,
    ...extra,
  };
}

const ENTRANTS: RunEntrant[] = [
  entrant("brayzon"),
  entrant("c0d33"),
  entrant("dreamsalong"),
  entrant("zaunus13"),
  entrant("basscannon"),
  entrant("g1", { profileId: null, handle: null, displayName: "Walk-in Sam" }),
  entrant("early", { droppedAfterRound: 0 }),
];
const SEED = "finished-run";

/** p1 wins 2–1, except that `upsets` names the players who beat p1 instead. */
function post(
  proposed: readonly ProposedRunPairing[],
  round: number,
  upsets: ReadonlySet<string> = new Set(),
): RunPairing[] {
  return proposed.map((p) => ({
    id: `r${round}t${p.table}`,
    roundId: `round-${round}`,
    round,
    table: p.table,
    p1EntrantId: p.p1EntrantId,
    p2EntrantId: p.p2EntrantId,
    games:
      p.p2EntrantId === null
        ? null
        : upsets.has(p.p2EntrantId)
          ? { p1Wins: 1, p2Wins: 2, draws: 0 }
          : { p1Wins: 2, p2Wins: 1, draws: 0 },
    status: "confirmed",
  }));
}

/** Three Swiss rounds of six, then a top 4 the fourth seed wins. */
function playedRun(): FinishedRun {
  let pairings: RunPairing[] = [];
  const rounds: RunRound[] = [];
  for (let round = 1; round <= 3; round += 1) {
    const result = pairSwiss({ entrants: ENTRANTS, pairings, seed: SEED, round });
    if (!result.ok) throw new Error(`round ${round}`);
    pairings = [...pairings, ...post(result.pairings, round)];
    rounds.push({
      id: `round-${round}`,
      runId: "run",
      number: round,
      kind: "swiss",
      pairedAt: "x",
    });
  }

  const seeds = cutSeeds(runStandings({ entrants: ENTRANTS, pairings, seed: SEED }), 4);
  const fourth = seeds[3] ?? "";
  let cut: RunPairing[] = [];
  for (let round = 4; ; round += 1) {
    const next = nextCutRound({ seeds, entrants: ENTRANTS, pairings: cut, round });
    if (next.kind !== "pairings") break;
    cut = [...cut, ...post(next.pairings, round, new Set([fourth]))];
    rounds.push({
      id: `round-${round}`,
      runId: "run",
      number: round,
      kind: "elimination",
      pairedAt: "x",
    });
  }

  return {
    name: "Planar Standard Weekly #42",
    date: "2026-10-17",
    run: { seed: SEED, topCut: 4 },
    entrants: ENTRANTS,
    rounds,
    pairings: [...pairings, ...cut],
    decklists: new Map([
      ["brayzon", "4 Llanowar Elves\n20 Forest"],
      ["g1", "4 Shock\n20 Mountain"],
      ["early", "4 Opt\n20 Island"],
      ["c0d33", "  "],
    ]),
  };
}

describe("core/runs/to-parsed-event", () => {
  const finished = playedRun();
  const parsed = toParsedEvent(finished);

  it("carries every pairing as a real match, so the event is rateable", () => {
    expect(parsed.capabilities).toEqual(["matches", "standings", "roster", "decklists"]);
    expect(parsed.matches).toHaveLength(finished.pairings.length);
    expect(parsed.issues).toEqual([]);
    expect(parsed).toMatchObject({ platform: "site", structure: "swiss + top 4", rounds: 5 });
  });

  it("enters a guest under run-guest-<id>, never their typed name", () => {
    const handles = new Set(
      parsed.matches?.flatMap((m) => [
        m.p1Handle,
        ...(m.p2Handle === undefined ? [] : [m.p2Handle]),
      ]),
    );
    expect(handles).toContain("run-guest-g1");
    expect(handles).not.toContain("Walk-in Sam");
    expect(runEntrantHandle({ id: "g1", handle: null })).toBe("run-guest-g1");
    expect(runEntrantHandle({ id: "e1", handle: "brayzon" })).toBe("brayzon");
  });

  it("keeps a bye out of the pairings a rating would consume", () => {
    const bye: RunPairing = {
      id: "bye",
      roundId: "round-1",
      round: 1,
      table: 4,
      p1EntrantId: "g1",
      p2EntrantId: null,
      games: null,
      status: "confirmed",
    };
    const [match] = toParsedEvent({ ...finished, pairings: [bye] }).matches ?? [];

    expect(match).toMatchObject({ p1Handle: "run-guest-g1", result: "bye" });
    expect(match?.p2Handle).toBeUndefined();
  });

  it("marks the top cut's matches as elimination", () => {
    const cut = parsed.matches?.filter((m) => m.isElimination) ?? [];
    expect(cut.map((m) => m.round)).toEqual([4, 4, 5]);
    expect(parsed.matches?.filter((m) => !m.isElimination).every((m) => (m.round ?? 0) <= 3)).toBe(
      true,
    );
  });

  it("places the champion first, the finalist second, then the rest by Swiss standing", () => {
    const swiss = runStandings({
      entrants: ENTRANTS,
      pairings: finished.pairings.filter((p) => p.round <= 3),
      seed: SEED,
    }).map((s) => runEntrantHandle(ENTRANTS.find((e) => e.id === s.entrantId) ?? entrant("?")));
    const placements = parsed.standings?.map((s) => s.handle);

    expect(placements?.[0]).toBe(swiss[3]);
    expect(new Set(placements?.slice(0, 4))).toEqual(new Set(swiss.slice(0, 4)));
    expect(placements?.slice(4)).toEqual(swiss.slice(4));
    expect(parsed.standings?.map((s) => s.placement)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("counts the cut in each player's record", () => {
    const champion = parsed.standings?.[0];
    expect((champion?.matchWins ?? 0) + (champion?.matchLosses ?? 0)).toBe(5);
  });

  it("leaves out an entrant who dropped before round 1, and a blank decklist", () => {
    expect(parsed.standings?.map((s) => s.handle)).not.toContain("early");
    expect(parsed.roster?.map((r) => r.handle)).not.toContain("early");
    expect(parsed.decklists?.map((d) => d.handle)).toEqual(["brayzon", "run-guest-g1"]);
    expect(parsed.roster?.find((r) => r.handle === "run-guest-g1")?.displayName).toBe(
      "Walk-in Sam",
    );
  });

  it("claims `matches` only when it produced some, and omits empty payloads (E12.8)", () => {
    const empty = toParsedEvent({ ...finished, rounds: [], pairings: [], decklists: new Map() });

    expect("matches" in empty).toBe(false);
    expect(empty.capabilities).not.toContain("matches");
    expect(empty.capabilities.includes("matches")).toBe((empty.matches ?? []).length > 0);
    expect(parsed.capabilities.includes("matches")).toBe((parsed.matches ?? []).length > 0);
  });

  it("stages an unconfirmed result for review instead of guessing it", () => {
    const [first, ...rest] = finished.pairings;
    if (first === undefined) throw new Error("no pairings");
    const pending = toParsedEvent({
      ...finished,
      pairings: [{ ...first, status: "reported" }, ...rest],
    });
    expect(pending.matches?.[0]?.result).toBeNull();
    expect(pending.issues).toMatchObject([{ code: "unconfirmed-result", rowIndex: 0 }]);
  });
});
