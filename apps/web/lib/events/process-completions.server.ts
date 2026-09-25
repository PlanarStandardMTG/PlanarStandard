import type { EventSource } from "@ps/contracts";
import { COMPLETION_LEASE_MS, COMPLETION_MAX_ATTEMPTS } from "@ps/core";
import { claimCompletions, markCompletionFailed, markCompletionProcessed } from "@ps/db";

import { onTournamentCompleted } from "@/lib/events/on-tournament-completed.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * Work the queue of finished tournaments (E23.13). Whatever runs this — a cron,
 * a manual trigger, the route at `/api/jobs/process-completed-events` — the
 * queue is the database's, so runners can change or overlap without an event
 * being handled twice.
 *
 * Each claimed event goes through `onTournamentCompleted` once. One that fails is
 * released with its error and retried on a later run; after
 * `COMPLETION_MAX_ATTEMPTS` it stays in the queue, unclaimable, for an admin to
 * look at on `/admin/processing`.
 */

/** Per run. Each event will cost a few requests against its source, so a run stays small. */
const DEFAULT_LIMIT = 5;

export interface ProcessReport {
  readonly claimed: number;
  readonly processed: number;
  readonly failed: readonly {
    readonly source: EventSource;
    readonly externalId: string;
    readonly error: string;
  }[];
}

export async function processCompletedEvents(
  options: { readonly limit?: number; readonly source?: EventSource; readonly now?: Date } = {},
): Promise<ProcessReport> {
  const now = options.now ?? new Date();
  const service = createServiceRoleClient();

  const claimed = await claimCompletions(service, {
    limit: options.limit ?? DEFAULT_LIMIT,
    leaseCutoff: new Date(now.getTime() - COMPLETION_LEASE_MS).toISOString(),
    maxAttempts: COMPLETION_MAX_ATTEMPTS,
    ...(options.source === undefined ? {} : { source: options.source }),
  });

  let processed = 0;
  const failed: { source: EventSource; externalId: string; error: string }[] = [];

  // One at a time: each event spends its source's rate limit, and a run is not
  // in a hurry.
  for (const completion of claimed) {
    try {
      await onTournamentCompleted(completion);
      await markCompletionProcessed(service, completion, new Date().toISOString());
      processed += 1;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      await markCompletionFailed(service, completion, error);
      failed.push({ source: completion.source, externalId: completion.externalId, error });
    }
  }

  return { claimed: claimed.length, processed, failed };
}
