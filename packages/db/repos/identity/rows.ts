import type {
  Exclusion,
  ExclusionReason,
  IdentityId,
  IdentityPlatform,
  IdentityRef,
  IdentitySource,
  MergeMoves,
  MergeSuggestion,
  MergeSuggestionId,
  MergeSuggestionStatus,
  Player,
  PlayerId,
  PlayerMerge,
  PlayerMergeId,
  PlayerVisibility,
  ProfileId,
  Signal,
  TournamentId,
} from "@ps/contracts";

/**
 * The identity tables as PostgREST returns them. Kept next to the mappers: outside
 * this module these are contract types, and the snake_case shape of the tables
 * is nobody else's business.
 *
 * `confidence` is `numeric` and so arrives as `number | string` — see
 * `repos/ratings/rows.ts` for why that matters rather than being tidiness.
 */
export interface PlayerRow {
  readonly id: string;
  readonly display_name: string;
  readonly slug: string;
  readonly profile_id: string | null;
  readonly visibility: string;
  readonly merged_into: string | null;
  readonly created_at: string;
}

export interface IdentityRow {
  readonly id: string;
  readonly player_id: string;
  readonly platform: string;
  readonly handle: string;
  readonly normalized: string;
  readonly source: string;
  readonly is_primary: boolean;
}

export interface ExclusionRow {
  readonly identity_a: string;
  readonly identity_b: string;
  readonly reason: string;
  readonly tournament_id: string | null;
}

export interface MergeSuggestionRow {
  readonly id: string;
  readonly player_a: string;
  readonly player_b: string;
  readonly confidence: number | string;
  readonly evidence: unknown;
  readonly status: string;
  readonly reviewed_by: string | null;
  readonly reviewed_at: string | null;
}

export interface PlayerMergeRow {
  readonly id: string;
  readonly winner_id: string;
  readonly loser_id: string;
  readonly reason: string | null;
  readonly moved: unknown;
  readonly merged_by: string | null;
  readonly created_at: string;
  readonly undone_at: string | null;
  readonly undone_by: string | null;
}

export const PLAYER_COLUMNS =
  "id, display_name, slug, profile_id, visibility, merged_into, created_at";

export const IDENTITY_COLUMNS = "id, player_id, platform, handle, normalized, source, is_primary";

export const EXCLUSION_COLUMNS = "identity_a, identity_b, reason, tournament_id";

export const SUGGESTION_COLUMNS =
  "id, player_a, player_b, confidence, evidence, status, reviewed_by, reviewed_at";

export const MERGE_COLUMNS =
  "id, winner_id, loser_id, reason, moved, merged_by, created_at, undone_at, undone_by";

export function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id as PlayerId,
    displayName: row.display_name,
    slug: row.slug,
    profileId: row.profile_id as ProfileId | null,
    visibility: row.visibility as PlayerVisibility,
    mergedInto: row.merged_into as PlayerId | null,
    createdAt: row.created_at,
  };
}

export function toIdentityRef(row: IdentityRow): IdentityRef {
  return {
    id: row.id as IdentityId,
    playerId: row.player_id as PlayerId,
    handle: {
      platform: row.platform as IdentityPlatform,
      raw: row.handle,
      normalized: row.normalized,
    },
    source: row.source as IdentitySource,
    isPrimary: row.is_primary,
  };
}

export function toExclusion(row: ExclusionRow): Exclusion {
  return {
    identityA: row.identity_a as IdentityId,
    identityB: row.identity_b as IdentityId,
    // `reason` is free text in the column on purpose (E13.10); the contract's
    // union is the vocabulary today, not a constraint the database enforces.
    reason: row.reason as ExclusionReason,
    tournamentId: row.tournament_id as TournamentId | null,
  };
}

export function toMergeSuggestion(row: MergeSuggestionRow): MergeSuggestion {
  return {
    id: row.id as MergeSuggestionId,
    playerA: row.player_a as PlayerId,
    playerB: row.player_b as PlayerId,
    confidence: Number(row.confidence),
    evidence: (row.evidence ?? []) as readonly Signal[],
    status: row.status as MergeSuggestionStatus,
    reviewedBy: row.reviewed_by as ProfileId | null,
    reviewedAt: row.reviewed_at,
  };
}

export function toPlayerMerge(row: PlayerMergeRow): PlayerMerge {
  return {
    id: row.id as PlayerMergeId,
    winnerId: row.winner_id as PlayerId,
    loserId: row.loser_id as PlayerId,
    reason: row.reason,
    moved: row.moved as MergeMoves,
    mergedBy: row.merged_by as ProfileId | null,
    createdAt: row.created_at,
    undoneAt: row.undone_at,
    undoneBy: row.undone_by as ProfileId | null,
  };
}
