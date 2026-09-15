import { describe, expect, it } from "vitest";

import { ARCHETYPE_RATE, CARD_WIN_RATE, INSUFFICIENT_DATA, suppressSmallN } from "./index";

describe("core/stats/suppress-small-n", () => {
  it("suppresses a card win rate under 20 games", () => {
    const verdict = suppressSmallN(12, 19, CARD_WIN_RATE);
    expect(verdict.level).toBe("hide");
    expect(verdict.n).toBe(19);
    // The enforcement: there is no rate on the hidden arm to accidentally render.
    expect("rate" in verdict).toBe(false);
    expect("interval" in verdict).toBe(false);
  });

  it("shows a card win rate at exactly the 20-game floor, greyed", () => {
    const verdict = suppressSmallN(12, 20, CARD_WIN_RATE);
    expect(verdict.level).toBe("grey");
    if (verdict.level === "hide") throw new Error("unreachable");
    expect(verdict.rate).toBeCloseTo(0.6, 12);
    expect(verdict.n).toBe(20);
    expect(verdict.interval.low).toBeCloseTo(0.386582, 6);
    expect(verdict.interval.high).toBeCloseTo(0.781193, 6);
  });

  it("shows a card win rate outright once the interval tightens", () => {
    expect(suppressSmallN(50, 100, CARD_WIN_RATE).level).toBe("show");
    expect(suppressSmallN(25, 50, CARD_WIN_RATE).level).toBe("show");
    expect(suppressSmallN(24, 49, CARD_WIN_RATE).level).toBe("grey");
  });

  it("collapses an archetype row with n < 3 to insufficient data", () => {
    const soloPilot = suppressSmallN(2, 2, ARCHETYPE_RATE);
    expect(soloPilot.level).toBe("hide");
    expect(soloPilot.n).toBe(2);
    expect(INSUFFICIENT_DATA).toBe("insufficient data");
  });

  it("greys a 3-0 archetype rather than reporting a confident 100%", () => {
    const verdict = suppressSmallN(3, 3, ARCHETYPE_RATE);
    expect(verdict.level).toBe("grey");
    if (verdict.level === "hide") throw new Error("unreachable");
    expect(verdict.rate).toBe(1);
    expect(verdict.interval.low).toBeCloseTo(0.438503, 6);
  });

  it("carries n on every arm", () => {
    for (const [k, n] of [
      [0, 0],
      [1, 2],
      [12, 20],
      [50, 100],
    ] as const) {
      expect(suppressSmallN(k, n, CARD_WIN_RATE).n).toBe(n);
    }
  });

  it("labels the card rate the way §24 requires", () => {
    expect(CARD_WIN_RATE.label).toBe("win rate of decks including this card");
    expect(CARD_WIN_RATE.label).not.toContain("card win rate");
  });

  it("hides rather than dividing by zero", () => {
    const verdict = suppressSmallN(0, 0, ARCHETYPE_RATE);
    expect(verdict.level).toBe("hide");
    expect(verdict.n).toBe(0);
  });

  it("keeps the plan-pinned floors where the plan pinned them", () => {
    expect(CARD_WIN_RATE.hideBelow).toBe(20);
    expect(ARCHETYPE_RATE.hideBelow).toBe(3);
  });
});
