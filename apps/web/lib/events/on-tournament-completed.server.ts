import { challongeApi, meleeApi } from "@ps/adapters";
import type { EventCompletion, IsoDate } from "@ps/contracts";

import { fetchChallongeResultsInput } from "@/lib/challonge/results-input.server";
import { fetchMeleeResultsInput } from "@/lib/melee/results-input.server";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { NoMatchesError, ingestEvent } from "@/lib/results/ingest-event.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * What happens once a tournament has ended (E23.13). Called exactly once per
 * event by `processCompletedEvents`, never inside a page render, and never
 * again after it returns — so this is the one place a finished tournament's
 * results are fetched.
 *
 * Every finished event's results are fetched scrubbed (E12.10, E12.13) and
 * ingested (E18.20, E18.24), which gives it a page; the lines an admin chose
 * (E18.22) decide the rest: the ladder recomputes when it is on the Elo line,
 * and its decklists are stored when it is on the decklist line. Challonge
 * sends no lists, so its events wait on the decklist tab for an admin's sheet.
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
      rate: completion.elo,
      decklists: completion.decklists,
    });
  } catch (error) {
    // A bracket closed without a match played. Retrying would spend Challonge's
    // monthly budget to learn the same; an event on a line still fails, loudly.
    const onALine = completion.elo || completion.decklists;
    if (error instanceof NoMatchesError && !onALine) return;
    throw error;
  }
}

/**
 * What an admin's "re-run everything" does before every finished tournament
 * goes round the queue again (`/admin/processing`): rebuild the ladder from the
 * ledger as it stands, so a rating never outlives the matches it came from.
 *
 * Never the ledger. `tournaments` and `matches` also hold organiser and manual
 * imports the queue cannot recreate, and re-importing an event supersedes its
 * old rows anyway (§26), so clearing them would lose data without fixing any.
 */
export async function onFullRerun(): Promise<void> {
  await recomputeRatings(createServiceRoleClient(), "full-rerun");
}
