import { describe, expect, it } from "vitest";

import { compareWinRates, deckWinRate } from "./index";

describe("core/stats/deck-win-rate", () => {
  it("sums every event's record into one rate", () => {
    const result = deckWinRate([
      { wins: 3, losses: 1, draws: 0 },
      { wins: 2, losses: 2 },
    ]);
    expect(result.record).toEqual({ wins: 5, losses: 3, draws: 0 });
    expect(result.verdict).toMatchObject({ level: "grey", rate: 5 / 8, n: 8 });
  });

  it("counts a draw as a match played and not won", () => {
    const result = deckWinRate([{ wins: 2, losses: 1, draws: 1 }]);
    expect(result.verdict).toMatchObject({ rate: 0.5, n: 4 });
  });

  it("withholds the rate under three matches, and for a deck never played", () => {
    expect(deckWinRate([{ wins: 2, losses: 0 }]).verdict).toEqual({ level: "hide", n: 2 });
    expect(deckWinRate([]).verdict).toEqual({ level: "hide", n: 0 });
  });

  it("shows the rate outright from ten matches", () => {
    expect(deckWinRate([{ wins: 6, losses: 4 }]).verdict.level).toBe("show");
  });

  it("orders by rate, then matches, with withheld rates last", () => {
    const hidden = deckWinRate([{ wins: 2, losses: 0 }]);
    const half = deckWinRate([{ wins: 2, losses: 2 }]);
    const halfOverMore = deckWinRate([{ wins: 5, losses: 5 }]);
    const best = deckWinRate([{ wins: 3, losses: 0 }]);

    expect([hidden, half, best, halfOverMore].sort(compareWinRates)).toEqual([
      best,
      halfOverMore,
      half,
      hidden,
    ]);
    expect(compareWinRates(half, deckWinRate([{ wins: 2, losses: 2 }]))).toBe(0);
  });
});
