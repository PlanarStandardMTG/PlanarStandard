import type {
  ArchetypeId,
  DeckId,
  FormatVersionId,
  PlayerId,
  SeasonId,
  Tournament,
  TournamentEntry,
  TournamentEntryId,
  TournamentId,
  TournamentStatus,
} from "@ps/contracts";

/**
 * The `tournaments` and `tournament_entries` rows as PostgREST returns them.
 * Kept next to the mappers: outside this module an event is a `Tournament`, and
 * the snake_case shape of the tables is nobody else's business.
 */
export interface TournamentRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly event_date: string;
  readonly season_id: string | null;
  readonly format_version_id: string | null;
  readonly platform: string | null;
  readonly external_url: string | null;
  readonly structure: string | null;
  readonly rounds: number | null;
  readonly player_count: number | null;
  readonly weight: number | string;
  readonly is_rated: boolean;
  readonly status: TournamentStatus;
  readonly created_at: string;
}

export interface TournamentEntryRow {
  readonly id: string;
  readonly tournament_id: string;
  readonly player_id: string;
  readonly deck_id: string | null;
  readonly archetype_id: string | null;
  readonly placement: number | null;
  readonly match_wins: number | null;
  readonly match_losses: number | null;
  readonly match_draws: number | null;
  readonly game_wins: number | null;
  readonly game_losses: number | null;
  readonly dropped: boolean;
  readonly deck_missing_reason: string | null;
}

export const TOURNAMENT_COLUMNS =
  "id, name, slug, event_date, season_id, format_version_id, platform, external_url, " +
  "structure, rounds, player_count, weight, is_rated, status, created_at";

export const ENTRY_COLUMNS =
  "id, tournament_id, player_id, deck_id, archetype_id, placement, match_wins, match_losses, " +
  "match_draws, game_wins, game_losses, dropped, deck_missing_reason";

/**
 * The statuses that mean "this event's results are in".
 *
 * `results_imported` is committed and `verified` is committed and checked;
 * `awaiting_results` and `draft` have nothing to show, and `archived` is
 * deliberately excluded from "latest" — an archived event is one somebody took
 * down, and resurfacing it on the home page would undo that.
 */
export const IMPORTED_STATUSES: readonly TournamentStatus[] = ["results_imported", "verified"];

export function toTournament(row: TournamentRow): Tournament {
  return {
    id: row.id as TournamentId,
    name: row.name,
    slug: row.slug,
    eventDate: row.event_date,
    seasonId: row.season_id as SeasonId | null,
    formatVersionId: row.format_version_id as FormatVersionId | null,
    platform: row.platform,
    externalUrl: row.external_url,
    structure: row.structure,
    rounds: row.rounds,
    playerCount: row.player_count,
    // `numeric` arrives as a JSON number from PostgREST, but a wide enough one
    // arrives as a string rather than lose precision. Coerced either way, because
    // a weight silently becoming "1.0" would multiply a rating by NaN.
    weight: Number(row.weight),
    isRated: row.is_rated,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toTournamentEntry(row: TournamentEntryRow): TournamentEntry {
  return {
    id: row.id as TournamentEntryId,
    tournamentId: row.tournament_id as TournamentId,
    playerId: row.player_id as PlayerId,
    deckId: row.deck_id as DeckId | null,
    archetypeId: row.archetype_id as ArchetypeId | null,
    placement: row.placement,
    // The columns default to 0 and are only null if somebody wrote one, so this
    // reports a record of 0-0-0 rather than inventing an absent one.
    record: {
      wins: row.match_wins ?? 0,
      losses: row.match_losses ?? 0,
      draws: row.match_draws ?? 0,
    },
    gameWins: row.game_wins ?? 0,
    gameLosses: row.game_losses ?? 0,
    dropped: row.dropped,
    deckMissingReason: row.deck_missing_reason,
  };
}
