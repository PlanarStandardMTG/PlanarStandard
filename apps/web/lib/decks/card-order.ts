import type { DeckSection } from "@ps/core";

import type { DeckViewCard } from "./deck-view";

export type CardOrder = "name" | "mana-value";

const byName = (a: DeckViewCard, b: DeckViewCard) => a.name.localeCompare(b.name);

const COMPARE: Record<CardOrder, (a: DeckViewCard, b: DeckViewCard) => number> = {
  name: byName,
  "mana-value": (a, b) => a.manaValue - b.manaValue || byName(a, b),
};

/** The same sections, each one's cards in `order`. */
export function orderCards(
  sections: readonly DeckSection<DeckViewCard>[],
  order: CardOrder,
): readonly DeckSection<DeckViewCard>[] {
  return sections.map((section) => ({
    ...section,
    cards: [...section.cards].sort(COMPARE[order]),
  }));
}
