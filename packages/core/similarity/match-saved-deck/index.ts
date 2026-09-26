import type { DeckCard } from "@ps/contracts";

import { normalizeName } from "../../decklist/normalize-name/index";
import { isBasicLand } from "../deck-vector/index";
import { weightedJaccard } from "../weighted-jaccard/index";

/**
 * Which of a member's saved decks an event's list is (E18.23): the one with
 * exactly its cards, or failing that the nearest, as the same deck tuned
 * between events usually is.
 */

export type ListCard = Pick<DeckCard, "oracleId" | "name" | "quantity" | "board">;

export interface ListedDeck {
  readonly cards: readonly ListCard[];
}

export interface SavedDeckMatch<T> {
  /** Every card, every board, the same count. */
  readonly exact: T | null;
  /** The nearest by main deck when nothing is exact, at `CLOSE_ENOUGH` or more. */
  readonly closest: { readonly deck: T; readonly similarity: number } | null;
}

/** Weighted Jaccard over the main deck. A few cards swapped out of sixty stays well above it. */
export const CLOSE_ENOUGH = 0.5;

export function matchSavedDeck<T extends ListedDeck>(
  cards: readonly ListCard[],
  saved: readonly T[],
): SavedDeckMatch<T> {
  const list = counts(cards, () => true);
  const exact =
    saved.find((deck) =>
      sameCounts(
        list,
        counts(deck.cards, () => true),
      ),
    ) ?? null;
  if (exact !== null) return { exact, closest: null };

  const main = counts(cards, mainSpells);
  let closest: SavedDeckMatch<T>["closest"] = null;
  for (const deck of saved) {
    const similarity = weightedJaccard(main, counts(deck.cards, mainSpells));
    if (similarity >= CLOSE_ENOUGH && similarity > (closest?.similarity ?? 0)) {
      closest = { deck, similarity };
    }
  }
  return { exact: null, closest };
}

/** Basic lands say nothing about which deck it is, as in `deck-vector`. */
const mainSpells = (card: ListCard) => card.board === "main" && !isBasicLand(card.name);

/**
 * By oracle id, falling back to the name for a card that did not resolve — a
 * list with an unknown card still matches itself. Typed as a `DeckVector` so
 * `weightedJaccard` takes it; the keys are only ever compared.
 */
function counts(cards: readonly ListCard[], keep: (card: ListCard) => boolean) {
  const vector = new Map<NonNullable<ListCard["oracleId"]>, number>();
  for (const card of cards) {
    if (!keep(card)) continue;
    const key = `${card.board}:${card.oracleId ?? normalizeName(card.name)}` as NonNullable<
      ListCard["oracleId"]
    >;
    vector.set(key, (vector.get(key) ?? 0) + card.quantity);
  }
  return vector;
}

function sameCounts(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  return a.size === b.size && [...a].every(([key, quantity]) => b.get(key) === quantity);
}
