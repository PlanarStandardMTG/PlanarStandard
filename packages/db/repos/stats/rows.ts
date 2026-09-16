import type {
  ArchetypeEventStats,
  ArchetypeId,
  ArchetypeShare,
  ArchetypeStats,
  CardEventStats,
  Color,
  ColorCounts,
  DeckId,
  DeckMetrics,
  EventSeries,
  LayoutPoint,
  MatchupStats,
  MvBuckets,
  OracleId,
  RarityCounts,
  SeasonId,
  SetCounts,
  SimilarityEdge,
  StatsBoard,
  CardStats,
  TypeCounts,
} from "@ps/contracts";

/**
 * The derived-statistics tables as PostgREST returns them. Kept next to the
 * mappers: outside this module these are contract types, and the snake_case
 * shape of the tables is nobody else's business.
 *
 * Every `numeric` is typed `number | string`, because PostgREST returns one as a
 * JSON number until the value is wide enough to need a string. A share that
 * arrives as `"0.0625"` sorts as text and renders as text without ever throwing
 * — see `repos/ratings/rows.ts`, where the same thing would silently alphabetize
 * a leaderboard.
 */
export interface DeckMetricsRow {
  readonly deck_id: string;
  readonly maindeck_count: number;
  readonly sideboard_count: number;
  readonly avg_mv_incl_lands: number | string | null;
  readonly avg_mv_excl_lands: number | string | null;
  readonly avg_mv_sideboard: number | string | null;
  readonly total_mv: number | string | null;
  readonly mv_buckets: unknown;
  readonly color_counts: unknown;
  readonly color_identity: string[] | null;
  readonly type_counts: unknown;
  readonly set_counts: unknown;
  readonly rarity_counts: unknown;
  readonly unresolved_cards: number;
  readonly computed_at: string;
}

export interface CardStatsRow {
  readonly season_id: string;
  readonly oracle_id: string;
  readonly board: string;
  readonly decks_including: number;
  readonly total_copies: number;
  readonly avg_copies: number | string;
  readonly inclusion_rate: number | string;
  readonly primary_archetype_id: string | null;
  readonly archetype_breakdown: unknown;
  readonly game_wins: number;
  readonly game_losses: number;
  readonly win_rate: number | string | null;
  readonly by_event: unknown;
}

export interface ArchetypeStatsRow {
  readonly season_id: string;
  readonly archetype_id: string;
  readonly deck_count: number;
  readonly share_of_supertype: number | string;
  readonly share_of_field: number | string;
  readonly round_wins: number;
  readonly round_losses: number;
  readonly round_draws: number;
  readonly game_wins: number;
  readonly game_losses: number;
  readonly game_win_rate: number | string | null;
  readonly round_win_rate: number | string | null;
  readonly wilson_low: number | string | null;
  readonly wilson_high: number | string | null;
  readonly by_event: unknown;
}

export interface SimilarityEdgeRow {
  readonly season_id: string;
  readonly deck_a: string;
  readonly deck_b: string;
  readonly similarity: number | string;
  readonly shared_cards: number;
}

export interface LayoutPointRow {
  readonly season_id: string;
  readonly deck_id: string;
  readonly x: number | string;
  readonly y: number | string;
  readonly layout_version: number;
}

export interface MatchupStatsRow {
  readonly season_id: string;
  readonly archetype_a: string;
  readonly archetype_b: string;
  readonly matches: number;
  readonly a_match_wins: number;
  readonly b_match_wins: number;
  readonly match_draws: number;
  readonly a_game_wins: number;
  readonly b_game_wins: number;
  readonly a_win_rate: number | string | null;
  readonly wilson_low: number | string | null;
  readonly wilson_high: number | string | null;
}

export const DECK_METRICS_COLUMNS =
  "deck_id, maindeck_count, sideboard_count, avg_mv_incl_lands, avg_mv_excl_lands, " +
  "avg_mv_sideboard, total_mv, mv_buckets, color_counts, color_identity, type_counts, " +
  "set_counts, rarity_counts, unresolved_cards, computed_at";

export const CARD_STATS_COLUMNS =
  "season_id, oracle_id, board, decks_including, total_copies, avg_copies, inclusion_rate, " +
  "primary_archetype_id, archetype_breakdown, game_wins, game_losses, win_rate, by_event";

export const ARCHETYPE_STATS_COLUMNS =
  "season_id, archetype_id, deck_count, share_of_supertype, share_of_field, round_wins, " +
  "round_losses, round_draws, game_wins, game_losses, game_win_rate, round_win_rate, " +
  "wilson_low, wilson_high, by_event";

export const SIMILARITY_COLUMNS = "season_id, deck_a, deck_b, similarity, shared_cards";

export const LAYOUT_COLUMNS = "season_id, deck_id, x, y, layout_version";

export const MATCHUP_COLUMNS =
  "season_id, archetype_a, archetype_b, matches, a_match_wins, b_match_wins, match_draws, " +
  "a_game_wins, b_game_wins, a_win_rate, wilson_low, wilson_high";

/** `null` stays `null`; `Number(null)` is 0, and a missing rate is not a rate of zero. */
const nullableNumber = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

export function toDeckMetrics(row: DeckMetricsRow): DeckMetrics {
  return {
    deckId: row.deck_id as DeckId,
    maindeckCount: row.maindeck_count,
    sideboardCount: row.sideboard_count,
    avgMvInclLands: nullableNumber(row.avg_mv_incl_lands),
    avgMvExclLands: nullableNumber(row.avg_mv_excl_lands),
    avgMvSideboard: nullableNumber(row.avg_mv_sideboard),
    totalMv: nullableNumber(row.total_mv),
    mvBuckets: row.mv_buckets as MvBuckets,
    colorCounts: row.color_counts as ColorCounts,
    colorIdentity: row.color_identity as readonly Color[] | null,
    typeCounts: row.type_counts as TypeCounts,
    setCounts: row.set_counts as SetCounts,
    rarityCounts: row.rarity_counts as RarityCounts,
    unresolvedCards: row.unresolved_cards,
    computedAt: row.computed_at,
  };
}

export function toCardStats(row: CardStatsRow): CardStats {
  return {
    seasonId: row.season_id as SeasonId,
    oracleId: row.oracle_id as OracleId,
    board: row.board as StatsBoard,
    decksIncluding: row.decks_including,
    totalCopies: row.total_copies,
    avgCopies: Number(row.avg_copies),
    inclusionRate: Number(row.inclusion_rate),
    primaryArchetypeId: row.primary_archetype_id as ArchetypeId | null,
    archetypeBreakdown: (row.archetype_breakdown ?? []) as readonly ArchetypeShare[],
    gameWins: row.game_wins,
    gameLosses: row.game_losses,
    winRate: nullableNumber(row.win_rate),
    byEvent: (row.by_event ?? []) as EventSeries<CardEventStats>,
  };
}

export function toArchetypeStats(row: ArchetypeStatsRow): ArchetypeStats {
  return {
    seasonId: row.season_id as SeasonId,
    archetypeId: row.archetype_id as ArchetypeId,
    deckCount: row.deck_count,
    shareOfSupertype: Number(row.share_of_supertype),
    shareOfField: Number(row.share_of_field),
    roundWins: row.round_wins,
    roundLosses: row.round_losses,
    roundDraws: row.round_draws,
    gameWins: row.game_wins,
    gameLosses: row.game_losses,
    gameWinRate: nullableNumber(row.game_win_rate),
    roundWinRate: nullableNumber(row.round_win_rate),
    wilsonLow: nullableNumber(row.wilson_low),
    wilsonHigh: nullableNumber(row.wilson_high),
    byEvent: (row.by_event ?? []) as EventSeries<ArchetypeEventStats>,
  };
}

export function toSimilarityEdge(row: SimilarityEdgeRow): SimilarityEdge {
  return {
    seasonId: row.season_id as SeasonId,
    deckA: row.deck_a as DeckId,
    deckB: row.deck_b as DeckId,
    similarity: Number(row.similarity),
    sharedCards: row.shared_cards,
  };
}

export function toLayoutPoint(row: LayoutPointRow): LayoutPoint {
  return {
    seasonId: row.season_id as SeasonId,
    deckId: row.deck_id as DeckId,
    x: Number(row.x),
    y: Number(row.y),
    layoutVersion: row.layout_version,
  };
}

export function toMatchupStats(row: MatchupStatsRow): MatchupStats {
  return {
    seasonId: row.season_id as SeasonId,
    archetypeA: row.archetype_a as ArchetypeId,
    archetypeB: row.archetype_b as ArchetypeId,
    matches: row.matches,
    aMatchWins: row.a_match_wins,
    bMatchWins: row.b_match_wins,
    matchDraws: row.match_draws,
    aGameWins: row.a_game_wins,
    bGameWins: row.b_game_wins,
    aWinRate: nullableNumber(row.a_win_rate),
    wilsonLow: nullableNumber(row.wilson_low),
    wilsonHigh: nullableNumber(row.wilson_high),
  };
}
