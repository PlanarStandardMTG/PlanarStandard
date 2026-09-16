import { describe, expect, it } from "vitest";

import { expectedScore } from "./index";

describe("core/elo/expected-score", () => {
  it("is an even match between equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(2100, 2100)).toBe(0.5);
  });

  it("gives a 400-point lead a 10:1 expectation", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 12);
    expect(expectedScore(1500, 1900)).toBeCloseTo(1 / 11, 12);
  });

  it("matches the published table at 100-point steps", () => {
    expect(expectedScore(1600, 1500)).toBeCloseTo(0.640065, 7);
    expect(expectedScore(1700, 1500)).toBeCloseTo(0.75974693, 7);
    expect(expectedScore(1800, 1500)).toBeCloseTo(0.84902044, 7);
  });

  it("sums to one from both sides, which is what makes the update zero-sum", () => {
    for (const [a, b] of [
      [1500, 1500],
      [1200, 1873],
      [2100, 1499],
    ] as const) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 12);
    }
  });

  it("stays strictly inside (0, 1) even at absurd gaps", () => {
    expect(expectedScore(4000, 100)).toBeLessThan(1);
    expect(expectedScore(4000, 100)).toBeGreaterThan(0.99);
    expect(expectedScore(100, 4000)).toBeGreaterThan(0);
  });

  it("rises monotonically with the rating gap", () => {
    const steps = [-400, -200, 0, 200, 400].map((gap) => expectedScore(1500 + gap, 1500));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i] as number).toBeGreaterThan(steps[i - 1] as number);
    }
  });
});
