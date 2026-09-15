import type { RatingConfig } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { kTier, pickK } from "./index";

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

describe("core/elo/pick-k", () => {
  it("uses provisional K until the player has played enough rated matches", () => {
    expect(pickK({ matchesPlayed: 0, rating: 1500 }, CONFIG, 1)).toBe(40);
    expect(pickK({ matchesPlayed: 14, rating: 1500 }, CONFIG, 1)).toBe(40);
    expect(pickK({ matchesPlayed: 15, rating: 1500 }, CONFIG, 1)).toBe(24);
  });

  it("uses elite K at and above the threshold", () => {
    expect(pickK({ matchesPlayed: 30, rating: 2099 }, CONFIG, 1)).toBe(24);
    expect(pickK({ matchesPlayed: 30, rating: 2100 }, CONFIG, 1)).toBe(16);
    expect(pickK({ matchesPlayed: 30, rating: 2500 }, CONFIG, 1)).toBe(16);
  });

  it("treats a highly rated newcomer as provisional, not elite", () => {
    // A rating earned in three matches has not been tested yet.
    expect(kTier({ matchesPlayed: 3, rating: 2400 }, CONFIG)).toBe("provisional");
    expect(pickK({ matchesPlayed: 3, rating: 2400 }, CONFIG, 1)).toBe(40);
  });

  it("multiplies by the tournament weight", () => {
    expect(pickK({ matchesPlayed: 30, rating: 1500 }, CONFIG, 1.5)).toBe(36);
    expect(pickK({ matchesPlayed: 0, rating: 1500 }, CONFIG, 0.5)).toBe(20);
  });

  it("reads every threshold from the config rather than hard-coding it", () => {
    const retuned: RatingConfig = {
      ...CONFIG,
      kProvisional: 64,
      kStandard: 32,
      kElite: 8,
      provisionalMatches: 5,
      eliteThreshold: 1800,
    };
    expect(pickK({ matchesPlayed: 4, rating: 1500 }, retuned, 1)).toBe(64);
    expect(pickK({ matchesPlayed: 5, rating: 1500 }, retuned, 1)).toBe(32);
    expect(pickK({ matchesPlayed: 5, rating: 1800 }, retuned, 1)).toBe(8);
  });
});
