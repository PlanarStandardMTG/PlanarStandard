import type { EventPodium } from "@ps/contracts";
import { colorIdentity, ratedByDefault } from "@ps/core";
import { listDecksWithCards, listTournamentFinishers, listTournamentsWithDecks } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { cardIndex } from "@/lib/cards/card-index";
import { toResolvedDeck } from "@/lib/decks/deck-view";
import { createPublicClient } from "@/lib/supabase/server";

/** How many finishers the home page shows. Four fills the row at every width. */
export const PODIUM_SIZE = 4;

/** Recent events with decks to look through for a Monthly; decks come almost only from Monthlies. */
const RECENT = 20;

/**
 * The podium, cached across requests and server instances.
 *
 * Its colour pips need the whole card index, and parsing it was most of the CPU
 * a new instance spent on its first `/`. Imports and deck edits revalidate `/`,
 * which expires this too; the hour is a backstop.
 */
export const cachedLatestPodium = unstable_cache(
  () => loadLatestPodium(createPublicClient()),
  ["latest-podium"],
  { revalidate: 60 * 60 },
);

/**
 * The top finishers of the last Monthly with decklists attached, with their
 * decks (E24.5). A Monthly is the whole word in the name, as `rated-by-default`
 * reads it. Null when there is none yet, and the section is left out rather
 * than shown empty.
 */
export async function loadLatestPodium(client: SupabaseClient): Promise<EventPodium | null> {
  const event = (await listTournamentsWithDecks(client, RECENT)).find((t) =>
    ratedByDefault(t.name),
  );
  if (event === undefined) return null;

  const finishers = (await listTournamentFinishers(client, event.id, PODIUM_SIZE)).slice(
    0,
    PODIUM_SIZE,
  );
  const decks = await listDecksWithCards(client, {
    ids: finishers.flatMap((f) => (f.deckId === null ? [] : [f.deckId])),
  });
  const index = cardIndex();

  return {
    name: event.name,
    slug: event.slug,
    date: event.eventDate,
    platform: event.platform,
    externalUrl: event.externalUrl,
    playerCount: event.playerCount,
    finishes: finishers.map((finisher) => {
      const deck = decks.find((d) => d.id === finisher.deckId);
      const resolved = deck === undefined ? null : toResolvedDeck(deck);
      return {
        placement: finisher.placement,
        handle: finisher.displayName ?? "Hidden player",
        archetype: deck?.archetypeRaw ?? null,
        deckName: deck?.name ?? null,
        deckId: deck?.id ?? null,
        record: finisher.record,
        colors: resolved === null ? [] : colorIdentity(resolved, index),
      };
    }),
  };
}
