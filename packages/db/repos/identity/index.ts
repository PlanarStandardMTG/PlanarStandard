import type {
  Exclusion,
  IdentityPlatform,
  IdentityRef,
  IdentitySource,
  MergeMoves,
  MergeSuggestion,
  MergeSuggestionId,
  MergeSuggestionStatus,
  NewPlayerMerge,
  Player,
  PlayerId,
  PlayerMerge,
  PlayerVisibility,
  ProfileId,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EXCLUSION_COLUMNS,
  IDENTITY_COLUMNS,
  MERGE_COLUMNS,
  PLAYER_COLUMNS,
  SUGGESTION_COLUMNS,
  toExclusion,
  toIdentityRef,
  toMergeSuggestion,
  toPlayer,
  toPlayerMerge,
  type ExclusionRow,
  type IdentityRow,
  type MergeSuggestionRow,
  type PlayerMergeRow,
  type PlayerRow,
} from "./rows";

/**
 * Reads and writes over the identity tables (E13.19).
 *
 * Two halves. The lookups are what an import uses to turn a handle into an
 * identity, and to make one when it misses (ADR 009). The curation functions are
 * admin surface: what can never be merged, what might want merging, and what was
 * merged.
 *
 * The curation half takes the **service-role** client because it has to.
 * `identity_exclusions`, `merge_suggestions` and `player_merges` have no read
 * policy at all — they are assertions about people rather than about an event's
 * data (E13.10) — so the anon client sees an empty result and no error.
 */

/** One player, by the slug their page is at. Null when nobody is at that slug. */
export async function getPlayerBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Player | null> {
  const { data, error } = await client
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error !== null) throw new Error(`getPlayerBySlug failed: ${error.message}`);
  return data === null ? null : toPlayer(data as unknown as PlayerRow);
}

/**
 * One player, by id.
 *
 * On the public client a hidden or merged-away player reads as null, because the
 * policy hides them. Pass the service client when you need the row regardless —
 * a merge has to be able to see the side it is merging away.
 */
export async function getPlayer(
  client: SupabaseClient,
  playerId: PlayerId,
): Promise<Player | null> {
  const { data, error } = await client
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("id", playerId)
    .maybeSingle();

  if (error !== null) throw new Error(`getPlayer failed: ${error.message}`);
  return data === null ? null : toPlayer(data as unknown as PlayerRow);
}

/**
 * The identity a handle belongs to, or null if this platform has never sent it.
 *
 * **Takes the normalized handle, not the raw one.** `normalized` is a generated
 * column and `packages/db` may not import `core/identity/normalize-handle` to
 * produce it — the dependency rule points the other way. The two are pinned to
 * `fixtures/identity/normalized-handles.json` and `generated-columns.test.ts`
 * asserts they agree, so a caller that normalizes with core gets what Postgres
 * stored.
 *
 * Null is the normal answer on a first appearance, and the caller's next move is
 * `createPlayerWithIdentity`: an unseen handle is a new person until somebody
 * merges it (Part IX answer 6).
 */
export async function findIdentityByNormalizedHandle(
  client: SupabaseClient,
  platform: IdentityPlatform,
  normalized: string,
): Promise<IdentityRef | null> {
  const { data, error } = await client
    .from("player_identities")
    .select(IDENTITY_COLUMNS)
    .eq("platform", platform)
    .eq("normalized", normalized)
    .maybeSingle();

  if (error !== null) throw new Error(`findIdentityByNormalizedHandle failed: ${error.message}`);
  return data === null ? null : toIdentityRef(data as unknown as IdentityRow);
}

/**
 * Every identity, on any platform, whose normalized handle is one of these.
 *
 * One read for a whole event's handles, and across platforms because a handle
 * seen on Challonge and melee.gg under the same normalized form is the same
 * person (E18.20). Which of these an import reuses is `core/identity/resolve-handles`'
 * decision, not this function's.
 */
export async function listIdentitiesByNormalized(
  client: SupabaseClient,
  normalized: readonly string[],
): Promise<readonly IdentityRef[]> {
  if (normalized.length === 0) return [];
  const { data, error } = await client
    .from("player_identities")
    .select(IDENTITY_COLUMNS)
    .in("normalized", [...new Set(normalized)])
    .order("created_at", { ascending: true });

  if (error !== null) throw new Error(`listIdentitiesByNormalized failed: ${error.message}`);
  return (data as unknown as IdentityRow[]).map(toIdentityRef);
}

/** Every handle one player has been seen under, primary first. */
export async function listIdentitiesByPlayer(
  client: SupabaseClient,
  playerId: PlayerId,
): Promise<readonly IdentityRef[]> {
  const { data, error } = await client
    .from("player_identities")
    .select(IDENTITY_COLUMNS)
    .eq("player_id", playerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error !== null) throw new Error(`listIdentitiesByPlayer failed: ${error.message}`);
  return (data as unknown as IdentityRow[]).map(toIdentityRef);
}

export interface NewPlayerWithIdentity {
  readonly displayName: string;
  /** The caller's, not ours: uniqueness is enforced by the column, not invented here. */
  readonly slug: string;
  readonly visibility?: PlayerVisibility;
  readonly platform: IdentityPlatform;
  /** Verbatim from the source. `normalized` is generated from it. */
  readonly handle: string;
  readonly source: IdentitySource;
}

/**
 * A new player and their first handle, which is one act rather than two.
 *
 * What an import does on a miss (ADR 009, E18.3). The identity is primary because
 * it is the only one; a merge is what makes that question interesting later.
 *
 * **Not atomic** — PostgREST has no transaction across two tables. A failure
 * between the two leaves a player with no identities, which is inert: nothing
 * reads a player except through an identity or a rating, and the next import of
 * the same handle creates a fresh pair rather than finding the orphan.
 */
export async function createPlayerWithIdentity(
  serviceClient: SupabaseClient,
  player: NewPlayerWithIdentity,
): Promise<IdentityRef> {
  const { data: created, error: playerError } = await serviceClient
    .from("players")
    .insert({
      display_name: player.displayName,
      slug: player.slug,
      visibility: player.visibility ?? "public",
    })
    .select("id")
    .single();

  if (playerError !== null)
    throw new Error(`createPlayerWithIdentity failed creating the player: ${playerError.message}`);

  return addIdentity(serviceClient, (created as { id: string }).id as PlayerId, {
    platform: player.platform,
    handle: player.handle,
    source: player.source,
    isPrimary: true,
  });
}

export interface NewIdentity {
  readonly platform: IdentityPlatform;
  readonly handle: string;
  readonly source: IdentitySource;
  readonly isPrimary?: boolean;
}

/**
 * Another handle for an existing player — an admin assignment, or a Discord
 * account paired after the fact.
 *
 * Fails on the `unique (platform, normalized)` constraint if that platform has
 * already sent this handle. That is the right failure: the handle already belongs
 * to somebody, and moving it is a merge rather than an insert.
 */
export async function addIdentity(
  serviceClient: SupabaseClient,
  playerId: PlayerId,
  identity: NewIdentity,
): Promise<IdentityRef> {
  const { data, error } = await serviceClient
    .from("player_identities")
    .insert({
      player_id: playerId,
      platform: identity.platform,
      handle: identity.handle,
      source: identity.source,
      is_primary: identity.isPrimary ?? false,
    })
    .select(IDENTITY_COLUMNS)
    .single();

  if (error !== null) throw new Error(`addIdentity failed: ${error.message}`);
  return toIdentityRef(data as unknown as IdentityRow);
}

/**
 * Every pair known not to be the same person.
 *
 * Read whole rather than by pair: `core/identity/score-candidates` takes the set
 * as an argument and zeroes any candidate it covers, so asking per candidate
 * would be one round trip per pair to answer a question the whole set answers
 * once.
 */
export async function listExclusions(serviceClient: SupabaseClient): Promise<readonly Exclusion[]> {
  const { data, error } = await serviceClient.from("identity_exclusions").select(EXCLUSION_COLUMNS);

  if (error !== null) throw new Error(`listExclusions failed: ${error.message}`);
  return (data as unknown as ExclusionRow[]).map(toExclusion);
}

/**
 * Record exclusions, skipping any pair already known.
 *
 * Additive on purpose, and the only write shape this table takes. An exclusion is
 * a fact that stays true — two handles in the same event were two people then and
 * still are — so a re-run of `co-appearance-exclusions` over a re-imported event
 * must not be able to remove one.
 *
 * Pairs must arrive ordered; `identity_a < identity_b` is a check constraint, and
 * `core/identity/co-appearance-exclusions` already emits them that way.
 */
export async function recordExclusions(
  serviceClient: SupabaseClient,
  exclusions: readonly Exclusion[],
): Promise<void> {
  if (exclusions.length === 0) return;

  const { error } = await serviceClient.from("identity_exclusions").upsert(
    exclusions.map((exclusion) => ({
      identity_a: exclusion.identityA,
      identity_b: exclusion.identityB,
      reason: exclusion.reason,
      tournament_id: exclusion.tournamentId,
    })),
    { onConflict: "identity_a,identity_b", ignoreDuplicates: true },
  );

  if (error !== null) throw new Error(`recordExclusions failed: ${error.message}`);
}

/** The review queue: unjudged pairs, most confident first (E18.17, E20.18). */
export async function listPendingMergeSuggestions(
  serviceClient: SupabaseClient,
  limit: number,
): Promise<readonly MergeSuggestion[]> {
  const { data, error } = await serviceClient
    .from("merge_suggestions")
    .select(SUGGESTION_COLUMNS)
    .eq("status", "pending")
    .order("confidence", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listPendingMergeSuggestions failed: ${error.message}`);
  return (data as unknown as MergeSuggestionRow[]).map(toMergeSuggestion);
}

/**
 * Replace the pending queue with a fresh scoring run.
 *
 * Clears **only** what is still pending, then inserts, skipping any pair that
 * already has a row. Both halves matter: a dismissal is a human's answer and a
 * later run must not resurrect the pair, and a merged pair must not come back as
 * a suggestion to merge it again.
 *
 * Pairs must arrive with `playerA < playerB`, which the ordered-pair check
 * constraint enforces — without it the same two people would queue twice, once
 * each way round.
 */
export async function replaceMergeSuggestions(
  serviceClient: SupabaseClient,
  suggestions: readonly Omit<MergeSuggestion, "id" | "status" | "reviewedBy" | "reviewedAt">[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("merge_suggestions")
    .delete()
    .eq("status", "pending");
  if (cleared !== null)
    throw new Error(`replaceMergeSuggestions failed clearing the queue: ${cleared.message}`);

  if (suggestions.length === 0) return;

  const { error } = await serviceClient.from("merge_suggestions").upsert(
    suggestions.map((suggestion) => ({
      player_a: suggestion.playerA,
      player_b: suggestion.playerB,
      confidence: suggestion.confidence,
      evidence: suggestion.evidence,
    })),
    { onConflict: "player_a,player_b", ignoreDuplicates: true },
  );

  if (error !== null) throw new Error(`replaceMergeSuggestions failed: ${error.message}`);
}

/** An admin's answer on one pair, with their name on it. */
export async function reviewMergeSuggestion(
  serviceClient: SupabaseClient,
  suggestionId: MergeSuggestionId,
  review: { readonly status: MergeSuggestionStatus; readonly reviewedBy: ProfileId },
): Promise<MergeSuggestion> {
  const { data, error } = await serviceClient
    .from("merge_suggestions")
    .update({
      status: review.status,
      reviewed_by: review.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)
    .select(SUGGESTION_COLUMNS)
    .single();

  if (error !== null) throw new Error(`reviewMergeSuggestion failed: ${error.message}`);
  return toMergeSuggestion(data as unknown as MergeSuggestionRow);
}

/**
 * Repoint everything the loser owns onto the winner, and say what moved.
 *
 * The three tables that carry a `player_id` and hold something somebody entered.
 * `matches` is not among them and never will be: it points at identities, which
 * is the whole of ADR 003 — the ledger does not change when two handles turn out
 * to be one person. The rating tables are absent for a different reason: they are
 * derived, and a merge is followed by a recompute rather than by moving a rating.
 *
 * The returned `MergeMoves` is what `recordPlayerMerge` persists, and is what
 * makes the merge reversible. Call the two together.
 */
export async function repointPlayerRows(
  serviceClient: SupabaseClient,
  loserId: PlayerId,
  winnerId: PlayerId,
): Promise<MergeMoves> {
  const moved = async (table: string): Promise<readonly string[]> => {
    const { data, error } = await serviceClient
      .from(table)
      .update({ player_id: winnerId })
      .eq("player_id", loserId)
      .select("id");

    if (error !== null) throw new Error(`repointPlayerRows failed on ${table}: ${error.message}`);
    return (data as { id: string }[]).map((row) => row.id);
  };

  return {
    identities: await moved("player_identities"),
    entries: await moved("tournament_entries"),
    decks: await moved("decks"),
  };
}

/**
 * Point the loser at the winner.
 *
 * The row stays. Deleting it would break an old link and orphan a `rating_event`
 * that recorded who somebody played; `merged_into` keeps both resolvable while
 * taking the loser off the leaderboard, which reads `merged_into is null`.
 */
export async function markPlayerMerged(
  serviceClient: SupabaseClient,
  loserId: PlayerId,
  winnerId: PlayerId,
): Promise<void> {
  const { error } = await serviceClient
    .from("players")
    .update({ merged_into: winnerId })
    .eq("id", loserId);

  if (error !== null) throw new Error(`markPlayerMerged failed: ${error.message}`);
}

/**
 * The audit row for a merge — what was merged, by whom, and what moved.
 *
 * `moved` is the reason the table exists. A merge with no record of what it
 * touched is not reversible, and reversibility is E18.16's acceptance criterion.
 */
export async function recordPlayerMerge(
  serviceClient: SupabaseClient,
  merge: NewPlayerMerge,
): Promise<PlayerMerge> {
  const { data, error } = await serviceClient
    .from("player_merges")
    .insert({
      winner_id: merge.winnerId,
      loser_id: merge.loserId,
      reason: merge.reason,
      moved: merge.moved,
      merged_by: merge.mergedBy,
    })
    .select(MERGE_COLUMNS)
    .single();

  if (error !== null) throw new Error(`recordPlayerMerge failed: ${error.message}`);
  return toPlayerMerge(data as unknown as PlayerMergeRow);
}

/** Merges, newest first — the history an undo is read out of. */
export async function listPlayerMerges(
  serviceClient: SupabaseClient,
  limit: number,
): Promise<readonly PlayerMerge[]> {
  const { data, error } = await serviceClient
    .from("player_merges")
    .select(MERGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listPlayerMerges failed: ${error.message}`);
  return (data as unknown as PlayerMergeRow[]).map(toPlayerMerge);
}
