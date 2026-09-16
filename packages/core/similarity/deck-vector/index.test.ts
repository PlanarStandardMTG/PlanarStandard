import type { OracleId, ResolvedCard, ResolvedDeck } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { deckVector, isBasicLand } from "./index";

const oracle = (n: number): OracleId =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as OracleId;

const card = (over: Partial<ResolvedCard> & Pick<ResolvedCard, "name">): ResolvedCard => ({
  qty: 4,
  oracleId: oracle(1),
  foil: false,
  board: "main",
  lineNumber: 1,
  ...over,
});

const deck = (cards: readonly ResolvedCard[]): ResolvedDeck => ({
  cards,
  issues: [],
  hasUnresolvedCards: cards.some((c) => c.oracleId === null),
});

describe("core/similarity/deck-vector", () => {
  it("maps cards to quantities", () => {
    const vector = deckVector(
      deck([
        card({ name: "Stock Up", oracleId: oracle(1), qty: 4 }),
        card({ name: "Refute", oracleId: oracle(2), qty: 2 }),
      ]),
    );
    expect([...vector]).toEqual([
      [oracle(1), 4],
      [oracle(2), 2],
    ]);
  });

  it("excludes basic lands, which say nothing about what a deck is doing", () => {
    const vector = deckVector(
      deck([
        card({ name: "Island", oracleId: oracle(9), qty: 7 }),
        card({ name: "Plains", oracleId: oracle(8), qty: 7 }),
        card({ name: "Stock Up", oracleId: oracle(1), qty: 4 }),
      ]),
    );
    expect([...vector.keys()]).toEqual([oracle(1)]);
  });

  it("keeps non-basic lands, which do", () => {
    const vector = deckVector(
      deck([
        card({ name: "Tranquil Cove", oracleId: oracle(5), qty: 4 }),
        card({ name: "Demolition Field", oracleId: oracle(6), qty: 2 }),
      ]),
    );
    expect(vector.size).toBe(2);
  });

  it("recognizes snow-covered basics and Wastes", () => {
    for (const name of ["Snow-Covered Forest", "Wastes", "snow-covered island"]) {
      expect(isBasicLand(name)).toBe(true);
    }
    for (const name of ["Tranquil Cove", "Forestwalk Trail", "Islandia"]) {
      expect(isBasicLand(name)).toBe(false);
    }
  });

  it("is maindeck only", () => {
    const vector = deckVector(
      deck([
        card({ name: "Stock Up", oracleId: oracle(1), qty: 4, board: "main" }),
        card({ name: "Negate", oracleId: oracle(3), qty: 2, board: "side" }),
      ]),
    );
    expect(vector.size).toBe(1);
    expect(vector.has(oracle(3))).toBe(false);
  });

  it("drops unresolved cards rather than matching on a raw name", () => {
    const vector = deckVector(
      deck([
        card({ name: "Stock Up", oracleId: oracle(1) }),
        card({ name: "Stockk Up", oracleId: null }),
      ]),
    );
    expect(vector.size).toBe(1);
  });

  it("sums duplicate lines for the same card", () => {
    const vector = deckVector(
      deck([
        card({ name: "Negate", oracleId: oracle(3), qty: 2, lineNumber: 1 }),
        card({ name: "Negate", oracleId: oracle(3), qty: 1, lineNumber: 9 }),
      ]),
    );
    expect(vector.get(oracle(3))).toBe(3);
  });

  it("returns an empty vector for an all-basics deck", () => {
    expect(deckVector(deck([card({ name: "Mountain", qty: 60 })])).size).toBe(0);
  });
});
