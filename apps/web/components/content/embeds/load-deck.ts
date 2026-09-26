import type { DeckId, DeckVisibility } from "@ps/contracts";
import type { DecklistEmbedData } from "@ps/core";
import { getDeckWithCards, isDeckInEvent } from "@ps/db";

import { buildDeckView, type DeckView } from "@/lib/decks/deck-view";
import { loadCurrentFormat } from "@/lib/format/current-format";
import { createSessionClient } from "@/lib/supabase/session";

/** A deck as a post's components show it, and as their exports write it. */
export interface LoadedDeck extends DecklistEmbedData {
  readonly id: string;
  readonly visibility: DeckVisibility;
  readonly view: DeckView;
}

/**
 * Read as the viewer, like the deck page: a private deck loads for its owner
 * only, and a removed one only while an event still shows it (E20.31).
 */
export async function loadDeck(id: string): Promise<LoadedDeck | null> {
  const session = await createSessionClient();
  const deck = await getDeckWithCards(session, id as DeckId);
  if (deck === null) return null;
  if (deck.hiddenAt !== null && !(await isDeckInEvent(session, deck.id))) return null;

  const format = await loadCurrentFormat();
  return {
    id: deck.id,
    name: deck.name,
    cards: deck.cards,
    visibility: deck.visibility,
    view: buildDeckView(deck, format.ok ? format.value : null),
  };
}
