import type { CardIndex, Color, OracleCard, ResolvedDeck } from "@ps/contracts";

import { normalizeName } from "../normalize-name/index";

/** What the deck browser narrows by. Every colour and every name must be present. */
export interface DeckFilter {
  readonly colors: readonly Color[];
  /** As typed, each matched anywhere in a card's name, case and punctuation aside. */
  readonly cards: readonly string[];
}

const SYMBOL = /\{([^}]+)\}/g;
const COLORS: readonly Color[] = ["W", "U", "B", "R", "G"];

/**
 * Whether a deck passes the browser's filter (E20.40). A colour counts when a
 * spell on any board has it in its mana cost — hybrid and Phyrexian symbols
 * count for each colour they name — so a land's identity never puts a deck in a
 * colour it does not cast. An unresolved line still matches by the name it was
 * written with.
 */
export function matchesDeckFilter(
  deck: ResolvedDeck,
  index: CardIndex,
  filter: DeckFilter,
): boolean {
  const cards = deck.cards.map((entry) => ({
    entry,
    card: entry.oracleId === null ? undefined : index.byOracleId.get(entry.oracleId)?.card,
  }));

  const colors = new Set<Color>();
  for (const { card } of cards) {
    if (card === undefined || /\bland\b/i.test(card.typeLine)) continue;
    for (const color of costColors(card)) colors.add(color);
  }
  if (!filter.colors.every((color) => colors.has(color))) return false;

  const names = cards.map(({ entry, card }) => normalizeName(card?.name ?? entry.name));
  return filter.cards
    .map(normalizeName)
    .filter((wanted) => wanted !== "")
    .every((wanted) => names.some((name) => name.includes(wanted)));
}

function costColors(card: OracleCard): readonly Color[] {
  const costs = [card.manaCost, ...(card.faces ?? []).map((face) => face.manaCost)];
  const symbols = costs.flatMap((cost) => [...(cost ?? "").matchAll(SYMBOL)].map((m) => m[1]));
  return COLORS.filter((color) => symbols.some((symbol) => symbol?.split("/").includes(color)));
}
