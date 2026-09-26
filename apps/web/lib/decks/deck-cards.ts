import type { DeckCard, ResolvedDeck } from "@ps/contracts";

/** A parsed and resolved list as the `deck_cards` rows it is stored as. */
export function toDeckCards(deck: ResolvedDeck): DeckCard[] {
  return deck.cards.map((card) => ({
    oracleId: card.oracleId,
    name: card.name,
    quantity: card.qty,
    board: card.board,
    set: card.set ?? null,
    collector: card.collector ?? null,
  }));
}
