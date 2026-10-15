import type { RunState } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { canMoveRun, runMoves } from "./index";
import type { RunProgress } from "./index";

const progress = (extra: Partial<RunProgress> = {}): RunProgress => ({
  checkedInEntrants: 8,
  swissRoundsPaired: 0,
  unconfirmedPairings: 0,
  cutFinished: false,
  ...extra,
});

const swissAndCut = { swissRounds: 3, topCut: 4 };
const reason = (move: ReturnType<typeof canMoveRun>) => (move.ok ? "ok" : move.reason);

describe("core/runs/run-state", () => {
  it("runs draft → registration → running → top cut → finished", () => {
    const steps: Array<[RunState, RunState, RunProgress]> = [
      ["draft", "registration", progress({ checkedInEntrants: 0 })],
      ["registration", "running", progress()],
      ["running", "top_cut", progress({ swissRoundsPaired: 3 })],
      ["top_cut", "finished", progress({ swissRoundsPaired: 3, cutFinished: true })],
    ];
    for (const [state, to, facts] of steps) {
      expect(canMoveRun({ state, ...swissAndCut }, to, facts)).toEqual({ ok: true });
    }
  });

  it("needs two checked-in entrants to start", () => {
    const move = canMoveRun(
      { state: "registration", ...swissAndCut },
      "running",
      progress({ checkedInEntrants: 1 }),
    );
    expect(move).toMatchObject({ ok: false, reason: "too-few-entrants" });
    expect(!move.ok && move.message).toMatch(/two entrants/);
  });

  it("needs every Swiss round played and every result confirmed before the cut", () => {
    const run = { state: "running" as const, ...swissAndCut };
    expect(reason(canMoveRun(run, "top_cut", progress({ swissRoundsPaired: 2 })))).toBe(
      "swiss-rounds-left",
    );
    expect(
      reason(
        canMoveRun(run, "top_cut", progress({ swissRoundsPaired: 3, unconfirmedPairings: 2 })),
      ),
    ).toBe("results-missing");
  });

  it("goes straight to the top cut when there are no Swiss rounds", () => {
    const run = { state: "registration" as const, swissRounds: 0, topCut: 8 };
    expect(canMoveRun(run, "top_cut", progress())).toEqual({ ok: true });
    expect(reason(canMoveRun(run, "running", progress()))).toBe("no-swiss-rounds");
    expect(
      reason(canMoveRun({ ...run, state: "registration", ...swissAndCut }, "top_cut", progress())),
    ).toBe("has-swiss-rounds");
    expect(reason(canMoveRun({ ...run, topCut: 0 }, "top_cut", progress()))).toBe("no-top-cut");
  });

  it("finishes after the last Swiss round when there is no cut", () => {
    const run = { state: "running" as const, swissRounds: 3, topCut: 0 };
    const done = progress({ swissRoundsPaired: 3 });
    expect(canMoveRun(run, "finished", done)).toEqual({ ok: true });
    expect(reason(canMoveRun(run, "top_cut", done))).toBe("no-top-cut");
    expect(reason(canMoveRun({ ...run, topCut: 8 }, "finished", done))).toBe("has-top-cut");
  });

  it("finishes the cut only once it has a champion and every result is in", () => {
    const run = { state: "top_cut" as const, ...swissAndCut };
    expect(reason(canMoveRun(run, "finished", progress()))).toBe("cut-unfinished");
    expect(
      reason(canMoveRun(run, "finished", progress({ cutFinished: true, unconfirmedPairings: 1 }))),
    ).toBe("results-missing");
  });

  it("cancels from anywhere until the run has finished", () => {
    for (const state of ["draft", "registration", "running", "top_cut"] as const) {
      expect(canMoveRun({ state, ...swissAndCut }, "cancelled", progress())).toEqual({ ok: true });
    }
    expect(reason(canMoveRun({ state: "finished", ...swissAndCut }, "cancelled", progress()))).toBe(
      "not-a-move",
    );
    expect(runMoves("cancelled")).toEqual([]);
  });

  it("refuses a move that skips a state, naming the reason", () => {
    const move = canMoveRun({ state: "draft", ...swissAndCut }, "running", progress());
    expect(move).toEqual({
      ok: false,
      reason: "not-a-move",
      message: "A run in draft cannot move to running.",
    });
  });
});
