import type { PlayerId, PlayerMerge, PlayerMergeId, ProfileId, TournamentId } from "@ps/contracts";
import { mergeBlockers } from "@ps/core";
import {
  getPlayer,
  getPlayerMerge,
  listIdentitiesByPlayer,
  listIdentityAppearances,
  markPlayerMerged,
  recordPlayerMerge,
  repointPlayerRows,
  undoPlayerMerge,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";

/**
 * Merge two players into one, and take a merge back (E18.16).
 *
 * The loser's handles, standings and decks move to the winner; `matches` does
 * not change, because it points at handles (ADR 003), and the ladder is
 * recomputed rather than moved (ADR 004). Two players who both played in one
 * event are two people, and no admin can say otherwise
 * (`core/identity/merge-blockers`).
 *
 * Takes the service-role client: the move touches decks and standings that the
 * admin's own session may not be allowed to write. The caller checks the role.
 */

export type MergeRefusal =
  | { readonly reason: "same-player" | "missing" | "already-merged" }
  | { readonly reason: "played-each-other"; readonly tournaments: readonly TournamentId[] };

export type MergeOutcome =
  { readonly ok: true; readonly merge: PlayerMerge } | ({ readonly ok: false } & MergeRefusal);

export async function mergePlayers(
  service: SupabaseClient,
  request: {
    readonly winnerId: PlayerId;
    readonly loserId: PlayerId;
    readonly reason: string | null;
    readonly mergedBy: ProfileId | null;
  },
): Promise<MergeOutcome> {
  const { winnerId, loserId } = request;
  if (winnerId === loserId) return { ok: false, reason: "same-player" };

  const [winner, loser] = await Promise.all([
    getPlayer(service, winnerId),
    getPlayer(service, loserId),
  ]);
  if (winner === null || loser === null) return { ok: false, reason: "missing" };
  if (winner.mergedInto !== null || loser.mergedInto !== null) {
    return { ok: false, reason: "already-merged" };
  }

  const [winnerIdentities, loserIdentities] = await Promise.all([
    listIdentitiesByPlayer(service, winnerId),
    listIdentitiesByPlayer(service, loserId),
  ]);
  const a = winnerIdentities.map((identity) => identity.id);
  const b = loserIdentities.map((identity) => identity.id);
  const blockers = mergeBlockers(a, b, await listIdentityAppearances(service, [...a, ...b]));
  if (blockers.length > 0) return { ok: false, reason: "played-each-other", tournaments: blockers };

  const moved = await repointPlayerRows(service, loserId, winnerId);
  await markPlayerMerged(service, loserId, winnerId);
  const merge = await recordPlayerMerge(service, {
    winnerId,
    loserId,
    reason: request.reason,
    moved,
    mergedBy: request.mergedBy,
  });
  await recomputeRatings(service, `merge:${merge.id}`);

  return { ok: true, merge };
}

export type UndoOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "missing" | "already-undone" | "since-merged" };

/**
 * Only the latest state can be unwound: once either player has been merged
 * again, moving this merge's rows back would pull them out of the later one.
 */
export async function undoMerge(
  service: SupabaseClient,
  mergeId: PlayerMergeId,
  undoneBy: ProfileId | null,
): Promise<UndoOutcome> {
  const merge = await getPlayerMerge(service, mergeId);
  if (merge === null) return { ok: false, reason: "missing" };
  if (merge.undoneAt !== null) return { ok: false, reason: "already-undone" };

  const [winner, loser] = await Promise.all([
    getPlayer(service, merge.winnerId),
    getPlayer(service, merge.loserId),
  ]);
  if (winner?.mergedInto !== null || loser?.mergedInto !== merge.winnerId) {
    return { ok: false, reason: "since-merged" };
  }

  await undoPlayerMerge(service, merge, undoneBy);
  await recomputeRatings(service, `unmerge:${merge.id}`);
  return { ok: true };
}
