import { describe, expect, it } from "vitest";

import { ratedByDefault } from "./index";

describe("core/elo/rated-by-default", () => {
  it("rates a Monthly", () => {
    expect(ratedByDefault("Monthly Championship Series - September 2026")).toBe(true);
  });

  it("ignores case and the word's position", () => {
    expect(ratedByDefault("planar standard MONTHLY #4")).toBe(true);
    expect(ratedByDefault("September Monthly")).toBe(true);
  });

  it("does not rate a side event whose name merely contains 'Month'", () => {
    expect(ratedByDefault("Mid-Month Madness #2 - White Elephant")).toBe(false);
    expect(ratedByDefault("Monthlies Qualifier")).toBe(false);
  });

  it("does not rate anything else", () => {
    expect(ratedByDefault("Planar Standard Weekly #40")).toBe(false);
    expect(ratedByDefault("Legality Fracture #1")).toBe(false);
    expect(ratedByDefault("")).toBe(false);
  });
});
