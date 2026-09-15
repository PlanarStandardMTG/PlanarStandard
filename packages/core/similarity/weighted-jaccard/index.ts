import type { DeckVector } from "@ps/contracts";

/**
 * Weighted Jaccard: `sum(min) / sum(max)` over the union of two decks.
 *
 * Weighted rather than plain set Jaccard because quantity carries real
 * information — a deck running one copy of a card is not playing the same deck
 * as one running four.
 */
export function weightedJaccard(a: DeckVector, b: DeckVector): number {
  if (a.size === 0 && b.size === 0) return 1;

  let minimums = 0;
  let maximums = 0;

  for (const [oracleId, quantity] of a) {
    const other = b.get(oracleId) ?? 0;
    minimums += Math.min(quantity, other);
    maximums += Math.max(quantity, other);
  }
  // Cards only b has: they contribute nothing to the numerator, everything to
  // the denominator.
  for (const [oracleId, quantity] of b) {
    if (!a.has(oracleId)) maximums += quantity;
  }

  return maximums === 0 ? 0 : minimums / maximums;
}

/** Cards both decks run, however many copies. Stored on `deck_similarity.shared_cards`. */
export function sharedCardCount(a: DeckVector, b: DeckVector): number {
  let shared = 0;
  for (const oracleId of a.keys()) if (b.has(oracleId)) shared += 1;
  return shared;
}
