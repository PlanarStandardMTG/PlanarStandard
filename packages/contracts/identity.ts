// players, player_identities, identity_exclusions, merge_suggestions and player_merges
// (§12), as the rest of the system refers to them. The ledger references identities, never
// players (ADR 003), so a merge repoints rows here and leaves `matches` untouched.

import type {
  DeckId,
  IdentityId,
  IsoDateTime,
  JsonValue,
  MergeSuggestionId,
  PlayerId,
  PlayerMergeId,
  ProfileId,
  TournamentEntryId,
  TournamentId,
} from "./primitives";

/** The `player_visibility` enum (§12). A hidden player is absent from the leaderboard view. */
export type PlayerVisibility = "public" | "hidden";

/**
 * A person, as distinct from the handles they played under. Nothing in the ledger points
 * here — that is ADR 003, and it is why a merge costs one row rather than a rewrite.
 */
export interface Player {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly slug: string;
  /** Set when somebody signs in and claims the player. Most never do (ADR 009). */
  readonly profileId: ProfileId | null;
  readonly visibility: PlayerVisibility;
  /**
   * The winner, on the losing side of a merge. The row stays rather than being deleted so
   * an old link and an old rating_event both still resolve.
   */
  readonly mergedInto: PlayerId | null;
  readonly createdAt: IsoDateTime;
}

export type IdentityPlatform = "discord" | "challonge" | "melee" | "mtgo" | "arena" | "manual";

export type IdentitySource =
  "import_inferred" | "admin_assigned" | "discord_oauth" | "organizer_entered";

/**
 * A handle as one platform spelled it. An unseen handle is a new person until an admin
 * merges it (Part IX answer 6).
 */
export interface Handle {
  readonly platform: IdentityPlatform;
  /** Verbatim from the source, trailing parenthetical alias and all: `Zaunus13 (LikoRS)`. */
  readonly raw: string;
  /**
   * `lower(regexp_replace(handle,'[^a-zA-Z0-9]','','g'))` — the generated column on
   * player_identities. core/identity/normalize-handle (E9.1) must match it exactly.
   */
  readonly normalized: string;
}

/** A persisted player_identities row. Matches point at these. */
export interface IdentityRef {
  readonly id: IdentityId;
  /** Current owner. A merge repoints this; no row in `matches` changes. */
  readonly playerId: PlayerId;
  readonly handle: Handle;
  readonly source: IdentitySource;
  readonly isPrimary: boolean;
}

/**
 * One scorer's opinion on one pair of handles. Uniform so that adding a signal is one new
 * file under core/identity/signals/ and no edit here (§8.6).
 *
 * A type alias rather than an interface: that keeps the implicit index signature, so a
 * Signal is assignable to JsonValue and goes into `merge_suggestions.evidence` as-is.
 */
export type Signal = {
  /**
   * The scorer — today `parenthetical`, `deck-fingerprint`, `trigram`, `containment`,
   * `temporal`. Deliberately open: a closed union would make every new signal a contract
   * change.
   */
  readonly kind: string;
  /** 0–1. Pinned by the plan: 0.95, 0.90, 0.60, 0.55, 0.30 for the five above. */
  readonly confidence: number;
  /** Whatever the scorer wants a reviewer to see; persisted unchanged. */
  readonly evidence: JsonValue;
};

export type ExclusionReason = "co_appearance" | "admin_dismissed";

/**
 * Two identities that are known not to be the same person.
 *
 * Producers must emit the pair ordered — `identity_a < identity_b` is a check constraint
 * on identity_exclusions (E9.7).
 */
export interface Exclusion {
  readonly identityA: IdentityId;
  readonly identityB: IdentityId;
  readonly reason: ExclusionReason;
  /** The event both handles played in; null for an admin dismissal. */
  readonly tournamentId: TournamentId | null;
}

/** What core/identity/score-candidates ranks and returns, before anything is persisted (E9.8). */
export interface MergeCandidate {
  readonly playerA: PlayerId;
  readonly playerB: PlayerId;
  /** 0–1 combined score. Zero whenever `excludedBy` is set, however strong the signals. */
  readonly confidence: number;
  readonly signals: readonly Signal[];
  /** Exclusions are between identities; the merge they block is between those identities' players. */
  readonly excludedBy: Exclusion | null;
}

export type MergeSuggestionStatus = "pending" | "merged" | "dismissed" | "stale";

/** A persisted merge_suggestions row. */
export interface MergeSuggestion {
  readonly id: MergeSuggestionId;
  readonly playerA: PlayerId;
  readonly playerB: PlayerId;
  readonly confidence: number;
  /** Per-signal, not a summary — the review queue has to show its work (E9.8). */
  readonly evidence: readonly Signal[];
  readonly status: MergeSuggestionStatus;
  readonly reviewedBy: ProfileId | null;
  readonly reviewedAt: IsoDateTime | null;
}

/**
 * What a merge repointed, recorded so it can be undone (E18.16).
 *
 * The three tables that carry a `player_id` and hold something somebody entered. The
 * rating tables are absent on purpose: they are derived, and a merge is followed by a full
 * recompute rather than by moving a rating from one player to another (ADR 004).
 */
export interface MergeMoves {
  readonly identities: readonly IdentityId[];
  readonly entries: readonly TournamentEntryId[];
  readonly decks: readonly DeckId[];
}

/** A persisted player_merges row: what was merged, and what moved when it was. */
export interface PlayerMerge {
  readonly id: PlayerMergeId;
  readonly winnerId: PlayerId;
  readonly loserId: PlayerId;
  readonly reason: string | null;
  readonly moved: MergeMoves;
  readonly mergedBy: ProfileId | null;
  readonly createdAt: IsoDateTime;
  /** Set when an admin took the merge back (E18.16). The row stays as the record that it happened. */
  readonly undoneAt: IsoDateTime | null;
  readonly undoneBy: ProfileId | null;
}

export type NewPlayerMerge = Omit<PlayerMerge, "id" | "createdAt" | "undoneAt" | "undoneBy">;
