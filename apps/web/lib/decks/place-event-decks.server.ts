import type { DeckId, FormatRules, FormatVersionId, Tournament } from "@ps/contracts";
import { bestFormat } from "@ps/core";
import { getFormatDetail, listDecksWithCards, listNamedEntries, setEventDeckFormats } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";
import { formatRules, toResolvedDeck } from "@/lib/decks/deck-view";

export interface Placement {
  /** Decks now checked against a different version than before. */
  readonly moved: number;
  /** Decks legal in none of their event's versions, left in its first. */
  readonly legalInNone: readonly DeckId[];
}

/**
 * Check each deck these events made against the first of its event's
 * versions it is legal in (E20.66). A member's own saved deck that an entry
 * names keeps its owner's choice.
 */
export async function placeEventDecks(
  service: SupabaseClient,
  tournaments: readonly Pick<Tournament, "id" | "formatVersionIds">[],
): Promise<Placement> {
  const rules = new Map<FormatVersionId, Promise<FormatRules | null>>();
  const rulesFor = (id: FormatVersionId) => {
    if (!rules.has(id)) rules.set(id, getFormatDetail(service, id).then(formatRules));
    return rules.get(id) as Promise<FormatRules | null>;
  };

  const index = cardIndex();
  const placed: { deckId: DeckId; formatVersionId: FormatVersionId }[] = [];
  const legalInNone = new Set<DeckId>();
  for (const tournament of tournaments) {
    if (tournament.formatVersionIds.length === 0) continue;
    const entries = await listNamedEntries(service, [tournament.id]);
    const decks = await listDecksWithCards(service, {
      ids: entries.flatMap((entry) => (entry.deckId === null ? [] : [entry.deckId])),
    });
    const formats = (await Promise.all(tournament.formatVersionIds.map(rulesFor))).filter(
      (format) => format !== null,
    );
    for (const deck of decks) {
      if (deck.submittedVia === "import") continue;
      const best = bestFormat(toResolvedDeck(deck), formats, index);
      if (best === null) continue;
      if (!best.legal) legalInNone.add(deck.id);
      if (best.formatVersionId !== deck.formatVersionId) {
        placed.push({ deckId: deck.id, formatVersionId: best.formatVersionId });
      }
    }
  }
  return { moved: await setEventDeckFormats(service, placed), legalInNone: [...legalInNone] };
}
