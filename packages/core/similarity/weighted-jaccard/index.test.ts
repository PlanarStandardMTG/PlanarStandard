import type { DeckVector, OracleId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { sharedCardCount, weightedJaccard } from "./index";

const oracle = (n: number): OracleId => `card-${n}` as OracleId;
const vec = (entries: ReadonlyArray<readonly [number, number]>): DeckVector =>
  new Map(entries.map(([id, qty]) => [oracle(id), qty]));

describe("core/similarity/weighted-jaccard", () => {
  it("scores identical decks 1", () => {
    const deck = vec([[1, 4], [2, 3], [3, 1]]);
    expect(weightedJaccard(deck, deck)).toBe(1);
    expect(weightedJaccard(deck, vec([[1, 4], [2, 3], [3, 1]]))).toBe(1);
  });

  it("scores disjoint decks 0", () => {
    expect(weightedJaccard(vec([[1, 4]]), vec([[2, 4]]))).toBe(0);
  });

  it("is symmetric", () => {
    const a = vec([[1, 4], [2, 2]]);
    const b = vec([[1, 1], [3, 4]]);
    expect(weightedJaccard(a, b)).toBe(weightedJaccard(b, a));
  });

  it("counts quantity, not just presence", () => {
    // Four copies against one is not the same deck, and set Jaccard would say it is.
    const four = vec([[1, 4]]);
    const one = vec([[1, 1]]);
    expect(weightedJaccard(four, one)).toBe(0.25);
  });

  it("computes sum(min) / sum(max) over the union", () => {
    const a = vec([[1, 4], [2, 2]]);
    const b = vec([[1, 2], [3, 4]]);
    // min: 2 + 0 + 0 = 2. max: 4 + 2 + 4 = 10.
    expect(weightedJaccard(a, b)).toBeCloseTo(0.2, 12);
  });

  it("scores a deck against an empty one as 0", () => {
    expect(weightedJaccard(vec([[1, 4]]), vec([]))).toBe(0);
    expect(weightedJaccard(vec([]), vec([[1, 4]]))).toBe(0);
  });

  it("treats two empty decks as identical rather than dividing by zero", () => {
    expect(weightedJaccard(vec([]), vec([]))).toBe(1);
  });

  it("counts shared cards regardless of how many copies", () => {
    expect(sharedCardCount(vec([[1, 4], [2, 1]]), vec([[1, 1], [3, 4]]))).toBe(1);
    expect(sharedCardCount(vec([]), vec([[1, 4]]))).toBe(0);
  });
});
