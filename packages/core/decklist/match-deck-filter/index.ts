import type { Color, DeckTraits } from "@ps/contracts";

import { normalizeName } from "../normalize-name/index";

/** What the deck browser narrows by. Every colour and every name must be present. */
export interface DeckFilter {
  readonly colors: readonly Color[];
  /** As typed, each matched anywhere in a card's name, case and punctuation aside. */
  readonly cards: readonly string[];
}

/**
 * Whether a deck passes the browser's filter (E20.40), read from its stored
 * traits (E20.72): every chosen colour is one it casts, and every name is part
 * of one of its cards' names.
 */
export function matchesDeckFilter(
  traits: Pick<DeckTraits, "castColors" | "cardNames">,
  filter: DeckFilter,
): boolean {
  if (!filter.colors.every((color) => traits.castColors.includes(color))) return false;

  return filter.cards
    .map(normalizeName)
    .filter((wanted) => wanted !== "")
    .every((wanted) => traits.cardNames.some((name) => name.includes(wanted)));
}
