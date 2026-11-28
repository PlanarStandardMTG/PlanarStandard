import type { IsoDate, RunId } from "@ps/contracts";
import { siteRun, siteRunInput } from "@ps/adapters";
import { linkRunTournament, listRunEntrantDecks } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ingestEvent, type IngestReport } from "@/lib/results/ingest-event.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

import type { RunView } from "./load-run";

/**
 * A finished run into the ledger (E26.21, ADR 015): its `ParsedEvent` through the same
 * `ingestEvent` every platform event takes, as source `site` with the run's id. The
 * import creates the run's tournament, or supersedes its last import after a
 * correction. Whether it counts for Elo is the admin's tick at /admin/processing.
 *
 * Decks are read with the organizer's own client, which may see every entrant's.
 */
export async function importFinishedRun(
  organizerClient: SupabaseClient,
  view: RunView,
): Promise<IngestReport> {
  const { run } = view;
  const decks = await listRunEntrantDecks(organizerClient, run.id);
  const date = (run.startsAt ?? new Date().toISOString()).slice(0, 10) as IsoDate;
  const input = siteRunInput(
    {
      name: run.name,
      date,
      run: { seed: run.seed, topCut: run.topCut },
      entrants: view.entrants,
      rounds: view.rounds,
      // Only what the ledger records: who reported a result is the run's business, and
      // carrying it would make an unchanged run hash differently.
      pairings: view.pairings.map((p) => ({
        id: p.id,
        roundId: p.roundId,
        round: p.round,
        table: p.table,
        p1EntrantId: p.p1EntrantId,
        p2EntrantId: p.p2EntrantId,
        games: p.games,
        status: p.status,
      })),
      decklists: new Map(decks.map((d) => [d.entrantId, d.decklistText])),
    },
    `run-${run.id}.json`,
  );

  const service = createServiceRoleClient();
  const report = await ingestEvent(service, {
    source: "site",
    externalId: run.id as RunId,
    adapter: siteRun,
    input,
    fallbackDate: date,
  });
  await linkRunTournament(service, run.id, report.tournament.id);
  return report;
}
