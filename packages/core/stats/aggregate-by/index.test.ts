import { describe, expect, it } from "vitest";

import { aggregateBy, countBy, groupBy, shareOf, sum, sumBy } from "./index";

interface DeckRow {
  readonly archetype: string;
  readonly copies: number;
  readonly wins: number;
}

// Real archetype names and shares from the Season II map.
const DECKS: readonly DeckRow[] = [
  { archetype: "Azorius Control", copies: 4, wins: 2 },
  { archetype: "Azorius Control", copies: 2, wins: 3 },
  { archetype: "Mono Red Burn", copies: 4, wins: 1 },
  { archetype: "Gruul Aggro", copies: 1, wins: 0 },
];

describe("core/stats/aggregate-by", () => {
  it("groups rows without losing any", () => {
    const groups = groupBy(DECKS, (d) => d.archetype);
    expect(groups.size).toBe(3);
    expect(groups.get("Azorius Control")).toHaveLength(2);
    expect([...groups.values()].flat()).toHaveLength(DECKS.length);
  });

  it("counts per key", () => {
    expect([...countBy(DECKS, (d) => d.archetype)]).toEqual([
      ["Azorius Control", 2],
      ["Mono Red Burn", 1],
      ["Gruul Aggro", 1],
    ]);
  });

  it("sums a value per key", () => {
    const copies = sumBy(
      DECKS,
      (d) => d.archetype,
      (d) => d.copies,
    );
    expect(copies.get("Azorius Control")).toBe(6);
    expect(copies.get("Gruul Aggro")).toBe(1);
  });

  it("leaves an absent key absent rather than defaulting it to zero", () => {
    const copies = sumBy(
      DECKS,
      (d) => d.archetype,
      (d) => d.copies,
    );
    expect(copies.has("Dimir Fog Mill")).toBe(false);
    expect(copies.get("Dimir Fog Mill")).toBeUndefined();
  });

  it("sums a whole list", () => {
    expect(sum(DECKS, (d) => d.wins)).toBe(6);
    expect(sum([], () => 1)).toBe(0);
  });

  it("folds each group from its own seed", () => {
    const totals = aggregateBy(
      DECKS,
      (d) => d.archetype,
      () => ({ copies: 0, wins: 0 }),
      (acc, d) => ({ copies: acc.copies + d.copies, wins: acc.wins + d.wins }),
    );
    expect(totals.get("Azorius Control")).toEqual({ copies: 6, wins: 5 });
    expect(totals.get("Mono Red Burn")).toEqual({ copies: 4, wins: 1 });
  });

  it("does not let a mutable accumulator leak between groups", () => {
    const buckets = aggregateBy(
      DECKS,
      (d) => d.archetype,
      (): string[] => [],
      (acc, d) => {
        acc.push(`${d.copies}`);
        return acc;
      },
    );
    expect(buckets.get("Azorius Control")).toEqual(["4", "2"]);
    expect(buckets.get("Gruul Aggro")).toEqual(["1"]);
  });

  it("turns counts into shares that sum to one", () => {
    const shares = shareOf(countBy(DECKS, (d) => d.archetype));
    expect(shares.get("Azorius Control")).toBeCloseTo(0.5, 12);
    expect(shares.get("Mono Red Burn")).toBeCloseTo(0.25, 12);
    expect(sum(shares.values(), (v) => v)).toBeCloseTo(1, 12);
  });

  it("returns no shares at all when the total is zero", () => {
    expect(shareOf(new Map([["Gruul Aggro", 0]])).size).toBe(0);
  });

  it("handles an empty input everywhere", () => {
    expect(groupBy([], () => "k").size).toBe(0);
    expect(countBy([], () => "k").size).toBe(0);
    expect(
      sumBy(
        [],
        () => "k",
        () => 1,
      ).size,
    ).toBe(0);
    expect(shareOf(new Map()).size).toBe(0);
  });
});
