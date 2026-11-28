import type { Color, DeckTraits } from "@ps/contracts";

import { normalizeName } from "../normalize-name/index";

/** What the deck browser narrows by. Every colour and every name must be present. */
export interface DeckFilter {
  readonly colors: readonly Color[];
  /** As typed, each matched anywhere in a card's name, case and punctuation aside. */
  readonly cards: readonly string[];
  /** As typed, matched anywhere in the name the deck is credited to (E20.73). */
  readonly creator: string;
}

/**
 * Whether a deck passes the browser's filter (E20.40), read from its stored
 * traits (E20.72): every chosen colour is one it casts, every name is part of
 * one of its cards' names, and the creator is part of its author's name.
 */
export function matchesDeckFilter(
  traits: Pick<DeckTraits, "castColors" | "cardNames">,
  author: string | null,
  filter: DeckFilter,
): boolean {
  if (!filter.colors.every((color) => traits.castColors.includes(color))) return false;

  const creator = normalizeName(filter.creator);
  if (creator !== "" && (author === null || !normalizeName(author).includes(creator))) return false;

  return filter.cards
    .map(normalizeName)
    .filter((wanted) => wanted !== "")
    .every((wanted) => traits.cardNames.some((name) => name.includes(wanted)));
}
