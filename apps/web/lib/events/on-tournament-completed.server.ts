import { challongeApi, meleeApi } from "@ps/adapters";
import type { EventCompletion, IsoDate } from "@ps/contracts";

import { fetchChallongeResultsInput } from "@/lib/challonge/results-input.server";
import { fetchMeleeResultsInput } from "@/lib/melee/results-input.server";
import { NoMatchesError, ingestEvent } from "@/lib/results/ingest-event.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * What happens once a tournament has ended (E23.13). Called exactly once per
 * event by `processCompletedEvents`, never inside a page render, and never
 * again after it returns — so this is the one place a finished tournament's
 * results are fetched.
 *
 * Every finished event's results are fetched scrubbed (E12.10, E12.13) and
 * ingested whole (E18.20, E25.1): matches, standings, and whatever decklists
 * the source sent. That gives it a page. What it counts towards is decided
 * later, on `/admin/processing`. Challonge sends no lists, so its events wait
 * on `/admin/fetching`'s decklist tab for an admin's sheet.
 *
 * Throw to fail: the completion is released and retried on a later run, up to
 * its attempt limit. Returning marks it processed for good.
 */
export async function onTournamentCompleted(completion: EventCompletion): Promise<void> {
  const melee = completion.source === "melee";
  const fetched = melee
    ? await fetchMeleeResultsInput(Number(completion.externalId))
    : await fetchChallongeResultsInput(completion.externalId);
  if (fetched.status === "not-configured") {
    throw new Error(`${melee ? "melee.gg" : "Challonge"} credentials are not set`);
  }
  if (fetched.status === "failed") throw new Error(fetched.error);

  try {
    await ingestEvent(createServiceRoleClient(), {
      source: completion.source,
      externalId: completion.externalId,
      adapter: melee ? meleeApi : challongeApi,
      input: fetched.input,
      fallbackDate: completion.detectedAt.slice(0, 10) as IsoDate,
    });
  } catch (error) {
    // A bracket closed without a match played. Retrying would spend Challonge's
    // monthly budget to learn the same, so it counts as fetched, and
    // `/admin/fetching` lists it under missing match history.
    if (error instanceof NoMatchesError) return;
    throw error;
  }
}
