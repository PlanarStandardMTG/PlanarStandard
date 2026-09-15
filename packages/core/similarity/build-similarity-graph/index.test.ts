import type { DeckId, DeckVector, OracleId, SeasonId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { DEFAULT_THRESHOLD, DUPLICATE_THRESHOLD, buildSimilarityGraph, findDuplicateDecks, type DeckEntry } from "./index";

const SEASON = "season-ii" as SeasonId;
const oracle = (n: number): OracleId => `card-${n}` as OracleId;
const vec = (entries: ReadonlyArray<readonly [number, number]>): DeckVector =>
  new Map(entries.map(([id, qty]) => [oracle(id), qty]));
const entry = (deckId: string, v: DeckVector): DeckEntry => ({ deckId: deckId as DeckId, vector: v });

const CORE = vec([[1, 4], [2, 4], [3, 4], [4, 4], [5, 4]]);

describe("core/similarity/build-similarity-graph", () => {
  it("emits an edge for every pair above the threshold", () => {
    const edges = buildSimilarityGraph(SEASON, [
      entry("a", CORE),
      entry("b", CORE),
      entry("c", vec([[9, 4]])),
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ seasonId: SEASON, deckA: "a", deckB: "b", similarity: 1 });
  });

  it("orders each pair so deckA < deckB, as the check constraint requires", () => {
    const edges = buildSimilarityGraph(SEASON, [entry("z", CORE), entry("a", CORE)]);
    expect(edges[0]?.deckA).toBe("a");
    expect(edges[0]?.deckB).toBe("z");
  });

  it("emits each pair exactly once", () => {
    const edges = buildSimilarityGraph(SEASON, [
      entry("a", CORE),
      entry("b", CORE),
      entry("c", CORE),
    ]);
    expect(edges).toHaveLength(3);
    expect(new Set(edges.map((e) => `${e.deckA}|${e.deckB}`)).size).toBe(3);
  });

  it("produces the same edge list whatever order the decks arrive in", () => {
    const decks = [entry("c", CORE), entry("a", CORE), entry("b", vec([[1, 4], [2, 4], [3, 4]]))];
    const forwards = buildSimilarityGraph(SEASON, decks);
    const backwards = buildSimilarityGraph(SEASON, [...decks].reverse());
    expect(backwards).toEqual(forwards);
  });

  it("defaults to the 0.5 threshold from the plan", () => {
    expect(DEFAULT_THRESHOLD).toBe(0.5);
    // 4 of 5 shared: min 16 / max 24 = 0.667, above the default.
    // (3 of 5 would be 12/28 = 0.43 — the union denominator counts b's cards too.)
    const partial = vec([[1, 4], [2, 4], [3, 4], [4, 4], [9, 4]]);
    expect(buildSimilarityGraph(SEASON, [entry("a", CORE), entry("b", partial)])).toHaveLength(1);
  });

  it("honours a threshold the caller supplies", () => {
    const partial = vec([[1, 4], [2, 4], [3, 4], [4, 4], [9, 4]]);
    const decks = [entry("a", CORE), entry("b", partial)];
    expect(buildSimilarityGraph(SEASON, decks, { threshold: 0.9 })).toHaveLength(0);
    expect(buildSimilarityGraph(SEASON, decks, { threshold: 0.1 })).toHaveLength(1);
  });

  it("records how many cards each pair shares", () => {
    const partial = vec([[1, 4], [2, 4], [3, 4], [4, 4], [9, 4]]);
    expect(buildSimilarityGraph(SEASON, [entry("a", CORE), entry("b", partial)])[0]?.sharedCards).toBe(4);
  });

  it("returns nothing for fewer than two decks", () => {
    expect(buildSimilarityGraph(SEASON, [])).toEqual([]);
    expect(buildSimilarityGraph(SEASON, [entry("a", CORE)])).toEqual([]);
  });

  describe("duplicate detection (E7.5)", () => {
    it("flags pairs at or above 0.85", () => {
      expect(DUPLICATE_THRESHOLD).toBe(0.85);
      const edges = buildSimilarityGraph(SEASON, [entry("a", CORE), entry("b", CORE)]);
      expect(findDuplicateDecks(edges)).toHaveLength(1);
    });

    it("leaves a merely similar pair alone", () => {
      const partial = vec([[1, 4], [2, 4], [3, 4], [4, 4], [9, 4]]);
      const edges = buildSimilarityGraph(SEASON, [entry("a", CORE), entry("b", partial)]);
      expect(edges).toHaveLength(1);
      expect(findDuplicateDecks(edges)).toHaveLength(0);
    });
  });
});
