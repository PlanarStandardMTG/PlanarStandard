import type { DeckId, FormatRules, FormatVersionId, TournamentId } from "@ps/contracts";
import { bestFormat } from "@ps/core";
import { getFormatDetail, listDecksWithCards, listNamedEntries, setEventDeckFormats } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";
import { formatRules, toResolvedDeck } from "@/lib/decks/deck-view";

/**
 * Check each deck an event made against the first of the event's versions it
 * is legal in (E20.66). A member's own saved deck that an entry names keeps
 * its owner's choice. Returns how many decks moved.
 */
export async function placeEventDecks(
  service: SupabaseClient,
  tournamentId: TournamentId,
  formatVersionIds: readonly FormatVersionId[],
): Promise<number> {
  if (formatVersionIds.length === 0) return 0;
  const entries = await listNamedEntries(service, [tournamentId]);
  const decks = await listDecksWithCards(service, {
    ids: entries.flatMap((entry) => (entry.deckId === null ? [] : [entry.deckId])),
  });
  const details = await Promise.all(formatVersionIds.map((id) => getFormatDetail(service, id)));
  const formats = details.flatMap((detail): FormatRules[] => {
    const rules = formatRules(detail);
    return rules === null ? [] : [rules];
  });

  const index = cardIndex();
  const placed = decks.flatMap((deck): { deckId: DeckId; formatVersionId: FormatVersionId }[] => {
    if (deck.submittedVia === "import") return [];
    const chosen = bestFormat(toResolvedDeck(deck), formats, index);
    return chosen === null || chosen === deck.formatVersionId
      ? []
      : [{ deckId: deck.id, formatVersionId: chosen }];
  });
  return await setEventDeckFormats(service, placed);
}
