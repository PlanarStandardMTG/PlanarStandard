import type { CardIndex, Color, DeckTraits, OracleCard, ResolvedDeck } from "@ps/contracts";

import { colorIdentity } from "../../metrics/color-counts/index";
import { normalizeName } from "../normalize-name/index";

const SYMBOL = /\{([^}]+)\}/g;
const COLORS: readonly Color[] = ["W", "U", "B", "R", "G"];

/**
 * What the deck browser shows and filters a deck by (E20.72), worked out once
 * when it is saved rather than on every visit to `/decks`.
 *
 * A cast colour is one a spell on any board has in its mana cost — hybrid and
 * Phyrexian symbols count for each colour they name — so a land's identity
 * never puts a deck in a colour it does not cast. An unresolved line keeps the
 * name it was written with.
 */
export function deckTraits(deck: ResolvedDeck, index: CardIndex): DeckTraits {
  const cards = deck.cards.map((entry) => ({
    entry,
    card: entry.oracleId === null ? undefined : index.byOracleId.get(entry.oracleId)?.card,
  }));

  const cast = new Set<Color>();
  for (const { card } of cards) {
    if (card === undefined || /\bland\b/i.test(card.typeLine)) continue;
    for (const color of costColors(card)) cast.add(color);
  }

  const names = new Set(cards.map(({ entry, card }) => normalizeName(card?.name ?? entry.name)));
  return {
    colors: colorIdentity(deck, index),
    castColors: COLORS.filter((color) => cast.has(color)),
    cardNames: [...names].filter((name) => name !== "").sort(),
  };
}

function costColors(card: OracleCard): readonly Color[] {
  const costs = [card.manaCost, ...(card.faces ?? []).map((face) => face.manaCost)];
  const symbols = costs.flatMap((cost) => [...(cost ?? "").matchAll(SYMBOL)].map((m) => m[1]));
  return COLORS.filter((color) => symbols.some((symbol) => symbol?.split("/").includes(color)));
}
