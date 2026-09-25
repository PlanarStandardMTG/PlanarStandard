import type { DeckCard } from "@ps/contracts";

/** A stored list back as text, in the shape the importer reads. */
export function deckAsText(cards: readonly DeckCard[]): string {
  const lines = (board: string) =>
    cards.filter((c) => c.board === board).map((c) => `${c.quantity} ${c.name}`);
  const side = lines("side");
  return [...lines("main"), ...(side.length > 0 ? ["", "Sideboard", ...side] : [])].join("\n");
}
