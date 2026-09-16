import type {
  ArchetypeId,
  ArchetypeStats,
  CardStats,
  DeckId,
  DeckMetrics,
  LayoutPoint,
  MatchupStats,
  OracleId,
  SeasonId,
  SimilarityEdge,
  StatsBoard,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ARCHETYPE_STATS_COLUMNS,
  CARD_STATS_COLUMNS,
  DECK_METRICS_COLUMNS,
  LAYOUT_COLUMNS,
  MATCHUP_COLUMNS,
  SIMILARITY_COLUMNS,
  toArchetypeStats,
  toCardStats,
  toDeckMetrics,
  toLayoutPoint,
  toMatchupStats,
  toSimilarityEdge,
  type ArchetypeStatsRow,
  type CardStatsRow,
  type DeckMetricsRow,
  type LayoutPointRow,
  type MatchupStatsRow,
  type SimilarityEdgeRow,
} from "./rows";

/**
 * Reads and writes over the derived-statistics tables (E13.21).
 *
 * **Nothing here holds an input.** Every row is produced by a recompute reading
 * `matches`, `decks` and `tournament_entries`, so the writes take the
 * service-role client — those tables have no write policy for anybody, which is
 * ADR 008 expressed as an absence (E14.2).
 *
 * The writes replace a season wholesale rather than updating rows in place, for
 * the same reason `replaceRatings` does: a recompute is a full rebuild (ADR 004),
 * and an API offering both would make a page depend on the order somebody
 * happened to call things in. Seasons are replaced independently because they are
 * independent — recomputing Season II must not clear Season I.
 *
 * None of these functions applies `suppress-small-n`. A stored rate arrives with
 * the `n` it came from and the caller renders the pair through E10.3; suppressing
 * here would hand the UI a rate with no way to say why it is missing.
 */

/** One deck's metrics. Null before `compute-deck-metrics` has run over it. */
export async function getDeckMetrics(
  client: SupabaseClient,
  deckId: DeckId,
): Promise<DeckMetrics | null> {
  const { data, error } = await client
    .from("deck_metrics")
    .select(DECK_METRICS_COLUMNS)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (error !== null) throw new Error(`getDeckMetrics failed: ${error.message}`);
  return data === null ? null : toDeckMetrics(data as unknown as DeckMetricsRow);
}

/**
 * Metrics for a set of decks in one round trip — what a deck list or the map
 * needs, rather than one request per deck.
 */
export async function listDeckMetrics(
  client: SupabaseClient,
  deckIds: readonly DeckId[],
): Promise<readonly DeckMetrics[]> {
  if (deckIds.length === 0) return [];

  const { data, error } = await client
    .from("deck_metrics")
    .select(DECK_METRICS_COLUMNS)
    .in("deck_id", deckIds as string[]);

  if (error !== null) throw new Error(`listDeckMetrics failed: ${error.message}`);
  return (data as unknown as DeckMetricsRow[]).map(toDeckMetrics);
}

/**
 * Write metrics for the decks just computed, replacing whatever was there.
 *
 * Keyed by deck rather than by season, so this upserts instead of clearing: a
 * deck's metrics depend only on that deck, and recomputing one is not a reason to
 * drop another's.
 */
export async function upsertDeckMetrics(
  serviceClient: SupabaseClient,
  metrics: readonly DeckMetrics[],
): Promise<void> {
  if (metrics.length === 0) return;

  const { error } = await serviceClient.from("deck_metrics").upsert(
    metrics.map((deck) => ({
      deck_id: deck.deckId,
      maindeck_count: deck.maindeckCount,
      sideboard_count: deck.sideboardCount,
      avg_mv_incl_lands: deck.avgMvInclLands,
      avg_mv_excl_lands: deck.avgMvExclLands,
      avg_mv_sideboard: deck.avgMvSideboard,
      total_mv: deck.totalMv,
      mv_buckets: deck.mvBuckets,
      color_counts: deck.colorCounts,
      color_identity: deck.colorIdentity,
      type_counts: deck.typeCounts,
      set_counts: deck.setCounts,
      rarity_counts: deck.rarityCounts,
      unresolved_cards: deck.unresolvedCards,
      computed_at: deck.computedAt,
    })),
    { onConflict: "deck_id" },
  );

  if (error !== null) throw new Error(`upsertDeckMetrics failed: ${error.message}`);
}

/**
 * The most-played cards of a season, on one board.
 *
 * Ordered by inclusion rate, which is what `card_stats_season_inclusion_idx`
 * indexes. `main` and `side` are asked for separately because they are different
 * questions — a card in a quarter of sideboards is not a card in a quarter of
 * decks.
 */
export async function listCardStats(
  client: SupabaseClient,
  seasonId: SeasonId,
  board: StatsBoard,
  limit: number,
): Promise<readonly CardStats[]> {
  const { data, error } = await client
    .from("card_stats")
    .select(CARD_STATS_COLUMNS)
    .eq("season_id", seasonId)
    .eq("board", board)
    .order("inclusion_rate", { ascending: false })
    // Ties break on the oracle id, so equal rates come back in a stable order
    // rather than whichever the planner returned this time.
    .order("oracle_id", { ascending: true })
    .limit(limit);

  if (error !== null) throw new Error(`listCardStats failed: ${error.message}`);
  return (data as unknown as CardStatsRow[]).map(toCardStats);
}

/** One card's season, both boards — what a card page reads. */
export async function getCardStats(
  client: SupabaseClient,
  seasonId: SeasonId,
  oracleId: OracleId,
): Promise<readonly CardStats[]> {
  const { data, error } = await client
    .from("card_stats")
    .select(CARD_STATS_COLUMNS)
    .eq("season_id", seasonId)
    .eq("oracle_id", oracleId)
    .order("board", { ascending: true });

  if (error !== null) throw new Error(`getCardStats failed: ${error.message}`);
  return (data as unknown as CardStatsRow[]).map(toCardStats);
}

/** Replace one season's card statistics with a recompute's output. */
export async function replaceCardStats(
  serviceClient: SupabaseClient,
  seasonId: SeasonId,
  stats: readonly CardStats[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("card_stats")
    .delete()
    .eq("season_id", seasonId);
  if (cleared !== null)
    throw new Error(`replaceCardStats failed clearing the season: ${cleared.message}`);

  if (stats.length === 0) return;

  const { error } = await serviceClient.from("card_stats").insert(
    stats.map((card) => ({
      season_id: card.seasonId,
      oracle_id: card.oracleId,
      board: card.board,
      decks_including: card.decksIncluding,
      total_copies: card.totalCopies,
      avg_copies: card.avgCopies,
      inclusion_rate: card.inclusionRate,
      primary_archetype_id: card.primaryArchetypeId,
      archetype_breakdown: card.archetypeBreakdown,
      game_wins: card.gameWins,
      game_losses: card.gameLosses,
      win_rate: card.winRate,
      by_event: card.byEvent,
    })),
  );

  if (error !== null) throw new Error(`replaceCardStats failed: ${error.message}`);
}

/** A season's metagame, largest share first — the table under the pie chart. */
export async function listArchetypeStats(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly ArchetypeStats[]> {
  const { data, error } = await client
    .from("archetype_stats")
    .select(ARCHETYPE_STATS_COLUMNS)
    .eq("season_id", seasonId)
    .order("share_of_field", { ascending: false })
    .order("archetype_id", { ascending: true });

  if (error !== null) throw new Error(`listArchetypeStats failed: ${error.message}`);
  return (data as unknown as ArchetypeStatsRow[]).map(toArchetypeStats);
}

/** Replace one season's archetype statistics with a recompute's output. */
export async function replaceArchetypeStats(
  serviceClient: SupabaseClient,
  seasonId: SeasonId,
  stats: readonly ArchetypeStats[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("archetype_stats")
    .delete()
    .eq("season_id", seasonId);
  if (cleared !== null)
    throw new Error(`replaceArchetypeStats failed clearing the season: ${cleared.message}`);

  if (stats.length === 0) return;

  const { error } = await serviceClient.from("archetype_stats").insert(
    stats.map((archetype) => ({
      season_id: archetype.seasonId,
      archetype_id: archetype.archetypeId,
      deck_count: archetype.deckCount,
      share_of_supertype: archetype.shareOfSupertype,
      share_of_field: archetype.shareOfField,
      round_wins: archetype.roundWins,
      round_losses: archetype.roundLosses,
      round_draws: archetype.roundDraws,
      game_wins: archetype.gameWins,
      game_losses: archetype.gameLosses,
      game_win_rate: archetype.gameWinRate,
      round_win_rate: archetype.roundWinRate,
      wilson_low: archetype.wilsonLow,
      wilson_high: archetype.wilsonHigh,
      by_event: archetype.byEvent,
    })),
  );

  if (error !== null) throw new Error(`replaceArchetypeStats failed: ${error.message}`);
}

/**
 * The matchup matrix for a season.
 *
 * One row per unordered pair, every rate from A's side. B's is `1 - aWinRate`
 * once draws are accounted for, and is not stored — two stored rates for one
 * matchup is two chances to disagree.
 */
export async function listMatchupStats(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly MatchupStats[]> {
  const { data, error } = await client
    .from("matchup_stats")
    .select(MATCHUP_COLUMNS)
    .eq("season_id", seasonId)
    .order("matches", { ascending: false })
    .order("archetype_a", { ascending: true });

  if (error !== null) throw new Error(`listMatchupStats failed: ${error.message}`);
  return (data as unknown as MatchupStatsRow[]).map(toMatchupStats);
}

/** Every matchup one archetype has, whichever side of the pair it sits on. */
export async function listMatchupsForArchetype(
  client: SupabaseClient,
  seasonId: SeasonId,
  archetypeId: ArchetypeId,
): Promise<readonly MatchupStats[]> {
  const { data, error } = await client
    .from("matchup_stats")
    .select(MATCHUP_COLUMNS)
    .eq("season_id", seasonId)
    // The pair is ordered, so an archetype is `archetype_a` in some rows and
    // `archetype_b` in the rest. Asking for one side is half an answer.
    .or(`archetype_a.eq.${archetypeId},archetype_b.eq.${archetypeId}`)
    .order("matches", { ascending: false });

  if (error !== null) throw new Error(`listMatchupsForArchetype failed: ${error.message}`);
  return (data as unknown as MatchupStatsRow[]).map(toMatchupStats);
}

/** Replace one season's matchup matrix with a recompute's output. */
export async function replaceMatchupStats(
  serviceClient: SupabaseClient,
  seasonId: SeasonId,
  stats: readonly MatchupStats[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("matchup_stats")
    .delete()
    .eq("season_id", seasonId);
  if (cleared !== null)
    throw new Error(`replaceMatchupStats failed clearing the season: ${cleared.message}`);

  if (stats.length === 0) return;

  const { error } = await serviceClient.from("matchup_stats").insert(
    stats.map((matchup) => ({
      season_id: matchup.seasonId,
      archetype_a: matchup.archetypeA,
      archetype_b: matchup.archetypeB,
      matches: matchup.matches,
      a_match_wins: matchup.aMatchWins,
      b_match_wins: matchup.bMatchWins,
      match_draws: matchup.matchDraws,
      a_game_wins: matchup.aGameWins,
      b_game_wins: matchup.bGameWins,
      a_win_rate: matchup.aWinRate,
      wilson_low: matchup.wilsonLow,
      wilson_high: matchup.wilsonHigh,
    })),
  );

  if (error !== null) throw new Error(`replaceMatchupStats failed: ${error.message}`);
}

/** The archetype map's edges for a season, strongest first (E7.3). */
export async function listSimilarityEdges(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly SimilarityEdge[]> {
  const { data, error } = await client
    .from("deck_similarity")
    .select(SIMILARITY_COLUMNS)
    .eq("season_id", seasonId)
    .order("similarity", { ascending: false });

  if (error !== null) throw new Error(`listSimilarityEdges failed: ${error.message}`);
  return (data as unknown as SimilarityEdgeRow[]).map(toSimilarityEdge);
}

/**
 * Replace one season's similarity edges.
 *
 * Pairs must arrive ordered — `deckA < deckB` is a check constraint. An
 * undirected edge stored twice is an edge counted twice by anything that walks
 * the graph, and the layout is one of those things.
 */
export async function replaceSimilarityEdges(
  serviceClient: SupabaseClient,
  seasonId: SeasonId,
  edges: readonly SimilarityEdge[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("deck_similarity")
    .delete()
    .eq("season_id", seasonId);
  if (cleared !== null)
    throw new Error(`replaceSimilarityEdges failed clearing the season: ${cleared.message}`);

  if (edges.length === 0) return;

  const { error } = await serviceClient.from("deck_similarity").insert(
    edges.map((edge) => ({
      season_id: edge.seasonId,
      deck_a: edge.deckA,
      deck_b: edge.deckB,
      similarity: edge.similarity,
      shared_cards: edge.sharedCards,
    })),
  );

  if (error !== null) throw new Error(`replaceSimilarityEdges failed: ${error.message}`);
}

/** Where each deck sits on the map. Seeded and reproducible run to run (E7.4). */
export async function listLayoutPoints(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly LayoutPoint[]> {
  const { data, error } = await client
    .from("deck_map_layout")
    .select(LAYOUT_COLUMNS)
    .eq("season_id", seasonId);

  if (error !== null) throw new Error(`listLayoutPoints failed: ${error.message}`);
  return (data as unknown as LayoutPointRow[]).map(toLayoutPoint);
}

/**
 * Replace one season's layout.
 *
 * Wholesale, and never point by point: the coordinates are one run of a seeded
 * force simulation, and half of one layout against half of another is a map of
 * nothing. `layoutVersion` is what stops an old cached image being read against
 * new coordinates.
 */
export async function replaceLayout(
  serviceClient: SupabaseClient,
  seasonId: SeasonId,
  points: readonly LayoutPoint[],
): Promise<void> {
  const { error: cleared } = await serviceClient
    .from("deck_map_layout")
    .delete()
    .eq("season_id", seasonId);
  if (cleared !== null)
    throw new Error(`replaceLayout failed clearing the season: ${cleared.message}`);

  if (points.length === 0) return;

  const { error } = await serviceClient.from("deck_map_layout").insert(
    points.map((point) => ({
      season_id: point.seasonId,
      deck_id: point.deckId,
      x: point.x,
      y: point.y,
      layout_version: point.layoutVersion,
    })),
  );

  if (error !== null) throw new Error(`replaceLayout failed: ${error.message}`);
}
