import type { PlayerId, RatingConfig } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { applyMatch, type PlayerSnapshot } from "./index";

const CONFIG: RatingConfig = {
  initialRating: 1500,
  kProvisional: 40,
  kStandard: 24,
  kElite: 16,
  provisionalMatches: 15,
  eliteThreshold: 2100,
  minMatchesForLeaderboard: 10,
  inactiveAfterDays: 120,
  countByes: false,
  countEliminationRounds: true,
};

const settled = (id: string, rating: number): PlayerSnapshot => ({
  playerId: id as PlayerId,
  rating,
  matchesPlayed: 30,
});

const swiss = { isElimination: false, tournamentWeight: 1 } as const;

describe("core/elo/apply-match", () => {
  it("moves both ratings by the same amount in opposite directions at equal K", () => {
    const result = applyMatch(
      { ...swiss, result: "p1_win" },
      settled("serlupidus", 1500),
      settled("sunsett", 1500),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    expect(result.update.p1.ratingAfter).toBe(1512);
    expect(result.update.p2.ratingAfter).toBe(1488);
  });

  it("cannot depend on the order the two sides are processed in", () => {
    const a = settled("serlupidus", 1723);
    const b = settled("sunsett", 1490);

    const forwards = applyMatch({ ...swiss, result: "p1_win" }, a, b, CONFIG);
    const backwards = applyMatch({ ...swiss, result: "p2_win" }, b, a, CONFIG);
    if (!forwards.applied || !backwards.applied) throw new Error("expected both to apply");

    expect(forwards.update.p1.ratingAfter).toBeCloseTo(backwards.update.p2.ratingAfter, 12);
    expect(forwards.update.p2.ratingAfter).toBeCloseTo(backwards.update.p1.ratingAfter, 12);
  });

  it("reads the loser's rating from before the match, not after the winner moved", () => {
    const result = applyMatch(
      { ...swiss, result: "p1_win" },
      settled("a", 1600),
      settled("b", 1400),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    // Both expectations are computed against the pre-match pair and must sum to 1.
    expect(result.update.p1.expectedScore + result.update.p2.expectedScore).toBeCloseTo(1, 12);
    expect(result.update.p1.ratingBefore).toBe(1600);
    expect(result.update.p2.ratingBefore).toBe(1400);
  });

  it("splits a draw, moving the underdog up and the favourite down", () => {
    const result = applyMatch(
      { ...swiss, result: "draw" },
      settled("favourite", 1800),
      settled("underdog", 1400),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    expect(result.update.p1.actualScore).toBe(0.5);
    expect(result.update.p2.actualScore).toBe(0.5);
    expect(result.update.p1.ratingAfter).toBeLessThan(1800);
    expect(result.update.p2.ratingAfter).toBeGreaterThan(1400);
  });

  it("penalises both players on a double loss", () => {
    const result = applyMatch(
      { ...swiss, result: "double_loss" },
      settled("a", 1500),
      settled("b", 1500),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    expect(result.update.p1.actualScore).toBe(0);
    expect(result.update.p2.actualScore).toBe(0);
    expect(result.update.p1.ratingAfter).toBeLessThan(1500);
    expect(result.update.p2.ratingAfter).toBeLessThan(1500);
  });

  it("never rates a bye, whatever countByes says", () => {
    for (const countByes of [false, true]) {
      const skipped = applyMatch({ ...swiss, result: "bye" }, settled("a", 1500), null, {
        ...CONFIG,
        countByes,
      });
      // countByes is about appearances, not ratings — there is no opponent here.
      expect(skipped).toEqual({ applied: false, reason: "bye" });
    }
  });

  it("skips an elimination round when the config excludes them", () => {
    const skipped = applyMatch(
      { result: "p1_win", isElimination: true, tournamentWeight: 1 },
      settled("a", 1500),
      settled("b", 1500),
      { ...CONFIG, countEliminationRounds: false },
    );
    expect(skipped).toEqual({ applied: false, reason: "elimination-excluded" });
  });

  it("applies an elimination round by default", () => {
    const result = applyMatch(
      { result: "p1_win", isElimination: true, tournamentWeight: 1 },
      settled("a", 1500),
      settled("b", 1500),
      CONFIG,
    );
    expect(result.applied).toBe(true);
  });

  it("uses each player's own K, so a provisional newcomer moves further", () => {
    const result = applyMatch(
      { ...swiss, result: "p1_win" },
      { playerId: "newcomer" as PlayerId, rating: 1500, matchesPlayed: 2 },
      settled("veteran", 1500),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    expect(result.update.p1.kFactor).toBe(40);
    expect(result.update.p2.kFactor).toBe(24);
    expect(result.update.p1.ratingAfter).toBe(1520);
    expect(result.update.p2.ratingAfter).toBe(1488);
  });

  it("scales both K factors by the tournament weight", () => {
    const result = applyMatch(
      { ...swiss, result: "p1_win", tournamentWeight: 2 },
      settled("a", 1500),
      settled("b", 1500),
      CONFIG,
    );
    if (!result.applied) throw new Error("expected the match to apply");
    expect(result.update.p1.kFactor).toBe(48);
    expect(result.update.p1.ratingAfter).toBe(1524);
  });
});
