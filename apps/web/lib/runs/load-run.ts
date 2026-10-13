import type {
  PostedRunPairing,
  Run,
  RunEntrant,
  RunId,
  RunRound,
  RunStanding,
} from "@ps/contracts";
import { runProgress, runStandings, type RunPosition } from "@ps/core";
import { getRun, listRunEntrants, listRunPairings, listRunRounds } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Everything a run's page and its actions need, read once and derived in core. */
export interface RunView {
  readonly run: Run;
  readonly entrants: readonly RunEntrant[];
  readonly rounds: readonly RunRound[];
  readonly pairings: readonly PostedRunPairing[];
  /** Swiss standings, derived on every read (ADR 004). */
  readonly standings: readonly RunStanding[];
  readonly position: RunPosition;
}

/** Null when the run is unknown, or a draft the caller may not see. */
export async function loadRun(client: SupabaseClient, runId: RunId): Promise<RunView | null> {
  const run = await getRun(client, runId);
  if (run === null) return null;
  const [entrants, rounds, pairings] = await Promise.all([
    listRunEntrants(client, runId),
    listRunRounds(client, runId),
    listRunPairings(client, runId),
  ]);
  const position = runProgress({ run, entrants, rounds, pairings });
  const standings = runStandings({ entrants, pairings: position.swissPairings, seed: run.seed });
  return { run, entrants, rounds, pairings, standings, position };
}
