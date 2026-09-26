import type { CardIndex, ResolvedDeck } from "@ps/contracts";

import { entriesOn, isLand } from "../shared";

/**
 * A few maindeck cards that say what a deck is, for a tile too small for the
 * list: its most-played spells, the costliest first among equals, since a deck's
 * four-drop finisher says more about it than its four one-mana removal spells.
 */
export function keyCards(deck: ResolvedDeck, index: CardIndex, count = 3): readonly string[] {
  return entriesOn(deck, index, "main")
    .filter(({ card }) => !isLand(card))
    .sort(
      (a, b) =>
        b.entry.qty - a.entry.qty ||
        b.card.manaValue - a.card.manaValue ||
        a.card.name.localeCompare(b.card.name),
    )
    .slice(0, count)
    .map(({ card }) => card.name);
}
