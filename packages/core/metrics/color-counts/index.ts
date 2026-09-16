import type {
  CardIndex,
  Color,
  ColorCountKey,
  ColorCounts,
  OracleCard,
  ResolvedDeck,
} from "@ps/contracts";

import { entriesOn } from "../shared";

const EMPTY: ColorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

/**
 * Cards per colour of **identity**, maindeck.
 *
 * Identity rather than cost, so a card with an off-colour activated ability
 * counts toward the colour its manabase actually has to support.
 *
 * A two-colour card counts once in **each** of its colours, so these do not sum
 * to the deck size. Colourless cards — artifacts, lands with no identity —
 * count under `C`, which is a bucket and not a sixth colour.
 *
 * **Lands are included**, unlike in `mana-curve`. A deck's manabase is part of
 * its colour commitment, and the chart this feeds is about what colours a deck
 * is playing rather than what it is casting.
 */
export function colorCounts(deck: ResolvedDeck, index: CardIndex): ColorCounts {
  const counts: Record<ColorCountKey, number> = { ...EMPTY };
  for (const { entry, card } of entriesOn(deck, index, "main")) {
    for (const key of keysFor(card)) counts[key] += entry.qty;
  }
  return counts;
}

/** The distinct colours of the maindeck, in WUBRG order. */
export function colorIdentity(deck: ResolvedDeck, index: CardIndex): readonly Color[] {
  const counts = colorCounts(deck, index);
  return (["W", "U", "B", "R", "G"] as const).filter((color) => counts[color] > 0);
}

function keysFor(card: OracleCard): readonly ColorCountKey[] {
  return card.colorIdentity.length === 0 ? ["C"] : card.colorIdentity;
}
