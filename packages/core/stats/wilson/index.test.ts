import { describe, expect, it } from "vitest";

import { wilson } from "./index";

/** Published 95% Wilson score bounds. The acceptance criterion is n = 1, 10, 100. */
const REFERENCE: ReadonlyArray<[successes: number, trials: number, low: number, high: number]> = [
  [0, 1, 0.0, 0.793451],
  [1, 1, 0.206549, 1.0],
  [0, 10, 0.0, 0.277533],
  [1, 10, 0.017876, 0.40415],
  [5, 10, 0.236593, 0.763407],
  [10, 10, 0.722467, 1.0],
  [20, 100, 0.133367, 0.288829],
  [50, 100, 0.403832, 0.596168],
  [90, 100, 0.825634, 0.944771],
];

describe("core/stats/wilson", () => {
  it.each(REFERENCE)("matches the published interval for %i/%i", (k, n, low, high) => {
    const interval = wilson(k, n);
    expect(interval.low).toBeCloseTo(low, 6);
    expect(interval.high).toBeCloseTo(high, 6);
    expect(interval.point).toBeCloseTo(k / n, 12);
    expect(interval.n).toBe(n);
  });

  it("stays inside [0, 1] at the extremes, where the normal approximation does not", () => {
    expect(wilson(0, 5).low).toBe(0);
    expect(wilson(5, 5).high).toBe(1);
  });

  it("is honest about a 3-0 archetype instead of reporting a certain 100%", () => {
    const interval = wilson(3, 3);
    expect(interval.point).toBe(1);
    expect(interval.low).toBeCloseTo(0.438503, 6);
    expect(interval.high).toBe(1);
    // The whole point of Wilson here: 3-0 is not evidence of a 100% deck.
    expect(interval.high - interval.low).toBeGreaterThan(0.5);
  });

  it("is symmetric about 0.5", () => {
    const won = wilson(7, 10);
    const lost = wilson(3, 10);
    expect(won.low).toBeCloseTo(1 - lost.high, 12);
    expect(won.high).toBeCloseTo(1 - lost.low, 12);
  });

  it("narrows as the sample grows", () => {
    const widths = [10, 100, 1000].map((n) => {
      const interval = wilson(n / 2, n);
      return interval.high - interval.low;
    });
    expect(widths[0]).toBeGreaterThan(widths[1] as number);
    expect(widths[1]).toBeGreaterThan(widths[2] as number);
  });

  it("returns the whole range for no observations rather than throwing", () => {
    expect(wilson(0, 0)).toEqual({ point: 0, low: 0, high: 1, n: 0 });
  });

  it("rejects counts that cannot describe a proportion", () => {
    expect(() => wilson(3, 2)).toThrow(RangeError);
    expect(() => wilson(-1, 10)).toThrow(RangeError);
    expect(() => wilson(1, -10)).toThrow(RangeError);
    expect(() => wilson(Number.NaN, 10)).toThrow(RangeError);
  });
});
