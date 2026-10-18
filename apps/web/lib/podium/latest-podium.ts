import type { EventPodium } from "@ps/contracts";
import { ratedByDefault } from "@ps/core";
import {
  listDeckTraits,
  listDecksWithCards,
  listTournamentFinishers,
  listTournamentsWithDecks,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";

/** How many finishers the home page shows. Four fills the row at every width. */
export const PODIUM_SIZE = 4;

/** Recent events with decks to look through for a Monthly; decks come almost only from Monthlies. */
const RECENT = 20;

/**
 * The podium, cached across requests and server instances: four database
 * reads in a row, on the page most visits start at. Imports and deck edits
 * revalidate `/`, which expires this too; the hour is a backstop.
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
  const deckIds = finishers.flatMap((f) => (f.deckId === null ? [] : [f.deckId]));
  // Colours from the stored traits (E20.72), so the home page never loads the card data.
  const [decks, traits] = await Promise.all([
    listDecksWithCards(client, { ids: deckIds }),
    listDeckTraits(client, deckIds),
  ]);

  return {
    name: event.name,
    slug: event.slug,
    date: event.eventDate,
    platform: event.platform,
    externalUrl: event.externalUrl,
    playerCount: event.playerCount,
    finishes: finishers.map((finisher) => {
      const deck = decks.find((d) => d.id === finisher.deckId);
      return {
        placement: finisher.placement,
        handle: finisher.displayName ?? "Hidden player",
        archetype: deck?.archetypeRaw ?? null,
        deckName: deck?.name ?? null,
        deckId: deck?.id ?? null,
        record: finisher.record,
        colors: (deck === undefined ? undefined : traits.get(deck.id)?.colors) ?? [],
      };
    }),
  };
}
