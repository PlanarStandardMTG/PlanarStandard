import type { RatingAnomaly, RatingWindow } from "@ps/contracts";
import { replay } from "@ps/core";
import {
  getRatingConfig,
  getRatingWindow,
  listLedgerMatchesInWindow,
  recordRatingRun,
  replaceRatings,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rebuild the leaderboard from the ledger (E18.12). Full replay every time, never
 * an increment (ADR 004): the rated matches in the admin's window (E25.6),
 * resolved to players at read time (ADR 003), through `core/elo/replay`,
 * replacing every rating.
 *
 * So anything that changes who a handle is, or whether an event counts — an
 * import, a merge, an admin flipping `is_rated` — is followed by this and nothing
 * else.
 */

export interface RecomputeReport {
  readonly window: RatingWindow;
  readonly matchesApplied: number;
  readonly players: number;
  readonly anomalies: readonly RatingAnomaly[];
  /** Ledger rows the read could not resolve to a player — always 0 against a consistent database. */
  readonly unresolved: number;
}

export async function recomputeRatings(
  service: SupabaseClient,
  trigger: string,
  now: Date = new Date(),
): Promise<RecomputeReport> {
  const started = now.getTime();
  const window = await getRatingWindow(service);
  const [config, ledger] = await Promise.all([
    getRatingConfig(service),
    listLedgerMatchesInWindow(service, window),
  ]);

  const result = replay(ledger.matches, config);
  await replaceRatings(service, result.ratings, result.events);
  await recordRatingRun(service, {
    trigger,
    matchCount: result.matchesApplied,
    playerCount: result.ratings.length,
    durationMs: Date.now() - started,
    anomalies: result.anomalies,
  });

  return {
    window,
    matchesApplied: result.matchesApplied,
    players: result.ratings.length,
    anomalies: result.anomalies,
    unresolved: ledger.unresolved,
  };
}
