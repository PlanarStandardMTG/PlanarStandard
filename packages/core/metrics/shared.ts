import type { CardIndex, OracleCard, ResolvedCard, ResolvedDeck } from "@ps/contracts";

/** A deck entry paired with the card the index knows about. Unresolved entries are absent. */
export interface ResolvedEntry {
  readonly entry: ResolvedCard;
  readonly card: OracleCard;
}

/** Resolved cards on one board, joined to the dataset. */
export function entriesOn(
  deck: ResolvedDeck,
  index: CardIndex,
  board: ResolvedCard["board"],
): readonly ResolvedEntry[] {
  const out: ResolvedEntry[] = [];
  for (const entry of deck.cards) {
    if (entry.board !== board || entry.oracleId === null) continue;
    const card = index.byOracleId.get(entry.oracleId)?.card;
    if (card !== undefined) out.push({ entry, card });
  }
  return out;
}

/** Lands are excluded from the curve and from one of the three average MVs. */
export function isLand(card: OracleCard): boolean {
  return /\bland\b/i.test(card.typeLine);
}
