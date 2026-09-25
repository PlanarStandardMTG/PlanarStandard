import { meleeApi } from "@ps/adapters";
import type { EventCompletion, IsoDate } from "@ps/contracts";

import { fetchMeleeResultsInput } from "@/lib/melee/results-input.server";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { ingestEvent } from "@/lib/results/ingest-event.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * What happens once a tournament has ended (E23.13). Called exactly once per
 * event by `processCompletedEvents`, never inside a page render, and never
 * again after it returns — so this is the one place a finished tournament's
 * results are fetched.
 *
 * melee.gg results are fetched scrubbed and ingested (E18.20), which recomputes
 * the ladder when the event is rated. Challonge results are not fetched yet
 * (E12.13–E12.14), so a Challonge event is marked processed with nothing done;
 * "Re-run everything" on `/admin/processing` picks them up once it is.
 *
 * Throw to fail: the completion is released and retried on a later run, up to
 * its attempt limit. Returning marks it processed for good.
 */
export async function onTournamentCompleted(completion: EventCompletion): Promise<void> {
  if (completion.source !== "melee") return;

  const fetched = await fetchMeleeResultsInput(Number(completion.externalId));
  if (fetched.status === "not-configured") throw new Error("melee.gg credentials are not set");
  if (fetched.status === "failed") throw new Error(fetched.error);

  await ingestEvent(createServiceRoleClient(), {
    source: "melee",
    externalId: completion.externalId,
    adapter: meleeApi,
    input: fetched.input,
    fallbackDate: completion.detectedAt.slice(0, 10) as IsoDate,
  });
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
