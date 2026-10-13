import type { RunEntrant, RunPairing, RunRound } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { runProgress } from "./index";

const entrant = (id: string, extra: Partial<RunEntrant> = {}): RunEntrant => ({
  id,
  runId: "run",
  profileId: null,
  displayName: id,
  handle: id,
  checkedIn: true,
  droppedAfterRound: null,
  ...extra,
});
const round = (number: number, kind: RunRound["kind"]): RunRound => ({
  id: `r${number}`,
  runId: "run",
  number,
  kind,
  pairedAt: "x",
});
const pairing = (
  number: number,
  p1: string,
  p2: string,
  status: RunPairing["status"] = "confirmed",
): RunPairing => ({
  id: `${number}-${p1}`,
  roundId: `r${number}`,
  round: number,
  table: 1,
  p1EntrantId: p1,
  p2EntrantId: p2,
  games: status === "pending" ? null : { p1Wins: 2, p2Wins: 0, draws: 0 },
  status,
});

const run = { swissRounds: 1, topCut: 2, seed: "s" };

describe("core/runs/run-progress", () => {
  it("counts a run before its first round", () => {
    const position = runProgress({
      run,
      entrants: [entrant("a"), entrant("b"), entrant("c", { checkedIn: false })],
      rounds: [],
      pairings: [],
    });
    expect(position).toMatchObject({
      checkedInEntrants: 2,
      swissRoundsPaired: 0,
      unconfirmedPairings: 0,
      cutFinished: false,
      nextRound: 1,
    });
  });

  it("splits Swiss from the cut and sees the cut finish", () => {
    const entrants = ["a", "b", "c", "d"].map((id) => entrant(id));
    const swiss = [pairing(1, "a", "b"), pairing(1, "c", "d")];
    const during = runProgress({
      run,
      entrants,
      rounds: [round(1, "swiss"), round(2, "elimination")],
      pairings: [...swiss, pairing(2, "a", "c", "reported")],
    });
    expect(during).toMatchObject({
      swissRoundsPaired: 1,
      unconfirmedPairings: 1,
      cutFinished: false,
      nextRound: 3,
    });
    expect(during.cutPairings).toHaveLength(1);

    const after = runProgress({
      run,
      entrants,
      rounds: [round(1, "swiss"), round(2, "elimination")],
      pairings: [...swiss, pairing(2, "a", "c")],
    });
    expect(after.cutFinished).toBe(true);
  });
});
