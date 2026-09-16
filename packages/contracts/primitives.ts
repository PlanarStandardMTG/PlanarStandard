// Scalars the eight domain modules of §7 share. Not a domain module itself — it exists
// so that `IsoDate` has one definition instead of four, and so the module that owns a
// concept doesn't also have to own every scalar its neighbours happen to need.

/**
 * A `YYYY-MM-DD` calendar date, for the `date` columns. A string rather than a `Date`
 * because core is pure and deterministic: a `Date` would put a timezone between the
 * ledger and replay's same-date tiebreak (E8.4).
 */
export type IsoDate = string;

/** An ISO 8601 instant, for the `timestamptz` columns. */
export type IsoDateTime = string;

/** Anything that survives a round trip through a `jsonb` column. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Row ids, as opaque strings.
 *
 * Here rather than in the module that owns each concept, for the reason at the
 * top of this file: a `Deck` row carries an owner, a player, a season, a format
 * version and an archetype, and if the id of each lived with its concept then
 * `decks` would have to import from five modules — three of which already import
 * from `decks`. Owning the concept is not the same as owning the scalar that
 * names it.
 *
 * `OracleId` is the exception and stays in `cards`: it is branded rather than a
 * plain alias, because an oracle id has no foreign key anywhere (§14.1) and the
 * brand is the only thing stopping any other string being passed where one
 * belongs.
 */
export type ProfileId = string;
export type PostId = string;
export type PostRevisionId = string;
export type DeckId = string;
export type ExternalEventId = string;
export type FormatVersionId = string;
export type IdentityId = string;
export type PlayerId = string;
export type MergeSuggestionId = string;
export type ArchetypeId = string;
export type AdapterId = string;
export type SeasonId = string;
export type TournamentId = string;
export type TournamentEntryId = string;
export type MatchId = string;
export type ResultImportId = string;
export type StagedMatchId = string;
export type MatchCorrectionId = string;
