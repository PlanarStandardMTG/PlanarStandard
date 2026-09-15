import type { DeckVector, OracleId, ResolvedDeck } from "@ps/contracts";

import { normalizeName } from "../../decklist/normalize-name/index";

/**
 * The basic lands, by normalized name. Detected by name rather than by type line
 * so `deck-vector` needs no card index — it is the only closed set of card names
 * in the game, and the snow variants are the only additions in a decade.
 */
const BASIC_LANDS: ReadonlySet<string> = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
  "snowcovered plains",
  "snowcovered island",
  "snowcovered swamp",
  "snowcovered mountain",
  "snowcovered forest",
]);

export function isBasicLand(cardName: string): boolean {
  return BASIC_LANDS.has(normalizeName(cardName));
}

/**
 * A deck as a card-to-quantity map, for similarity.
 *
 * Maindeck only, basics excluded, non-basic lands kept. Basics carry no
 * information about what a deck is doing — every green deck runs Forests — and
 * leaving them in makes two unrelated mono-colour decks look related.
 *
 * Unresolved cards are dropped: without an oracle id there is nothing to compare
 * across decks, and matching on raw names would make a typo look like a
 * different card.
 */
export function deckVector(deck: ResolvedDeck): DeckVector {
  const vector = new Map<OracleId, number>();
  for (const card of deck.cards) {
    if (card.board !== "main") continue;
    if (card.oracleId === null) continue;
    if (isBasicLand(card.name)) continue;
    vector.set(card.oracleId, (vector.get(card.oracleId) ?? 0) + card.qty);
  }
  return vector;
}
