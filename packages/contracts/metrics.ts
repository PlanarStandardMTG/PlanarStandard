import type { Color, OracleId, Rarity, SetCode } from "./cards";
import type { Board, DeckId } from "./decks";
import type { IsoDate, IsoDateTime } from "./primitives";
import type { SeasonId, TournamentId } from "./results";

export type ArchetypeId = string;

/**
 * The `archetype_supertype` enum (§14). Charts group by this by default — 58 archetypes
 * over 127 decks is confetti, five supertypes is a readable chart (Part VIII).
 */
export type ArchetypeSupertype =
  "aggro" | "midrange" | "control" | "combo" | "other";

/** Buckets 1–6 and 7+, non-lands only (§8.3). Keys are strings: the column is jsonb. */
export type MvBucket = "1" | "2" | "3" | "4" | "5" | "6" | "7+";
export type MvBuckets = Readonly<Record<MvBucket, number>>;

/** `C` is the colourless bucket, not a sixth colour. */
export type ColorCountKey = Color | "C";
export type ColorCounts = Readonly<Record<ColorCountKey, number>>;

export type CardTypeBucket =
  | "Land"
  | "Creature"
  | "Instant"
  | "Sorcery"
  | "Artifact"
  | "Enchantment"
  | "Planeswalker"
  | "Battle";

/**
 * A multi-type card lands in more than one bucket, so these need not sum to the deck size.
 * The rule is pinned in `docs/modules/metrics.md` and published at `/methodology` (E6.3, E6.8).
 */
export type TypeCounts = Readonly<Record<CardTypeBucket, number>>;

/**
 * Keyed by the card's **legal** set, never its printed set: `Llanowar Elves (M19)`
 * counts under FDN (`core/metrics/set-attribution`, E6.4).
 */
export type SetCounts = Readonly<Record<SetCode, number>>;

/** Read off the printing inside the legal pool, so `special` and `bonus` never appear (E6.5). */
export type MetricRarity = Extract<
  Rarity,
  "common" | "uncommon" | "rare" | "mythic"
>;
export type RarityCounts = Readonly<Record<MetricRarity, number>>;

/**
 * One `deck_metrics` row (§15). Every field is derived and recomputable (ADR 008);
 * the numerics are null until `compute-deck-metrics` has run over a deck with cards.
 */
export interface DeckMetrics {
  readonly deckId: DeckId;
  readonly maindeckCount: number;
  readonly sideboardCount: number;
  readonly avgMvInclLands: number | null;
  readonly avgMvExclLands: number | null;
  readonly avgMvSideboard: number | null;
  readonly totalMv: number | null;
  readonly mvBuckets: MvBuckets;
  readonly colorCounts: ColorCounts;
  readonly colorIdentity: readonly Color[] | null;
  readonly typeCounts: TypeCounts;
  readonly setCounts: SetCounts;
  readonly rarityCounts: RarityCounts;
  /** Lines whose name never resolved. Non-zero excludes the deck from `card_stats` (§26). */
  readonly unresolvedCards: number;
  readonly computedAt: IsoDateTime;
}

/**
 * `core/similarity/deck-vector` output (E7.1): maindeck card → quantity, basics excluded,
 * non-basic lands kept. A Map rather than a record — it is a computation intermediate,
 * never a stored row, and the key keeps its `OracleId` brand.
 */
export type DeckVector = ReadonlyMap<OracleId, number>;

/**
 * One `deck_similarity` row (§15). The pair is ordered — `deckA < deckB`, the table's
 * check constraint — so a pair appears once and the graph is undirected.
 */
export interface SimilarityEdge {
  readonly seasonId: SeasonId;
  readonly deckA: DeckId;
  readonly deckB: DeckId;
  /** Weighted Jaccard, 0–1 (E7.2). Edges below the 0.5 threshold are not stored. */
  readonly similarity: number;
  readonly sharedCards: number;
}

/**
 * One `deck_map_layout` row (§15). `layoutVersion` is bumped when `force-layout`'s
 * parameters change, so an old layout is never silently mixed with a new one (E7.4).
 */
export interface LayoutPoint {
  readonly seasonId: SeasonId;
  readonly deckId: DeckId;
  readonly x: number;
  readonly y: number;
  readonly layoutVersion: number;
}

/** One point of a `by_event` series. The envelope is shared; `stats` differs per table. */
export interface EventSeriesPoint<TStats> {
  readonly tournamentId: TournamentId;
  /** `tournaments.event_date`. */
  readonly eventDate: IsoDate;
  readonly stats: TStats;
}

/** Chronological, oldest first. */
export type EventSeries<TStats> = readonly EventSeriesPoint<TStats>[];

export interface CardEventStats {
  readonly decksIncluding: number;
  /** Decks in the event — the denominator of `inclusionRate`, and the `n` a chart must show. */
  readonly deckCount: number;
  readonly totalCopies: number;
  readonly inclusionRate: number;
}

export interface ArchetypeEventStats {
  readonly deckCount: number;
  readonly shareOfField: number;
  readonly roundWins: number;
  readonly roundLosses: number;
  readonly roundDraws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
}

/** How the decks running a card split across archetypes (`card_stats.archetype_breakdown`). */
export interface ArchetypeShare {
  readonly archetypeId: ArchetypeId;
  readonly decks: number;
  /** `decks / decksIncluding`, 0–1. */
  readonly share: number;
}

/** `card_stats.board` — the check constraint is ('main','side'); a commander pile has no row. */
export type StatsBoard = Extract<Board, "main" | "side">;

/** One `card_stats` row (§15), keyed by season, oracle card and board. */
export interface CardStats {
  readonly seasonId: SeasonId;
  readonly oracleId: OracleId;
  readonly board: StatsBoard;
  readonly decksIncluding: number;
  readonly totalCopies: number;
  /** Mean copies among decks that run it, not across the field. */
  readonly avgCopies: number;
  readonly inclusionRate: number;
  readonly primaryArchetypeId: ArchetypeId | null;
  readonly archetypeBreakdown: readonly ArchetypeShare[];
  readonly gameWins: number;
  readonly gameLosses: number;
  /**
   * Label this verbatim as **"win rate of decks including this card"**, never
   * "card win rate" — a card does not win games, the deck around it does (§24).
   * Null when unplayed; suppressed under 20 games, so render it through
   * `suppress-small-n` rather than reading the number directly (E10.3).
   */
  readonly winRate: number | null;
  readonly byEvent: EventSeries<CardEventStats>;
}

/** One `archetype_stats` row (§15). */
export interface ArchetypeStats {
  readonly seasonId: SeasonId;
  readonly archetypeId: ArchetypeId;
  readonly deckCount: number;
  readonly shareOfSupertype: number;
  readonly shareOfField: number;
  readonly roundWins: number;
  readonly roundLosses: number;
  readonly roundDraws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
  readonly gameWinRate: number | null;
  readonly roundWinRate: number | null;
  /** 95% Wilson bounds on `roundWinRate`. Null wherever that rate is null. */
  readonly wilsonLow: number | null;
  readonly wilsonHigh: number | null;
  readonly byEvent: EventSeries<ArchetypeEventStats>;
}

/**
 * One `matchup_stats` row (§15). The pair is ordered — `archetypeA < archetypeB`,
 * the table's check constraint — and every rate is reported from A's side.
 */
export interface MatchupStats {
  readonly seasonId: SeasonId;
  readonly archetypeA: ArchetypeId;
  readonly archetypeB: ArchetypeId;
  readonly matches: number;
  readonly aMatchWins: number;
  readonly bMatchWins: number;
  readonly matchDraws: number;
  readonly aGameWins: number;
  readonly bGameWins: number;
  readonly aWinRate: number | null;
  readonly wilsonLow: number | null;
  readonly wilsonHigh: number | null;
}

/** `core/stats/wilson` output (E10.1): a 95% interval that carries the sample it came from. */
export interface WilsonInterval {
  /** The observed proportion, 0–1. */
  readonly point: number;
  readonly low: number;
  readonly high: number;
  readonly n: number;
}

export type SuppressionLevel = "show" | "grey" | "hide";

/**
 * `core/stats/suppress-small-n` output (E10.3). Every user-visible rate goes through it
 * (ADR 012, §19), and the union is the enforcement: `n` is on every arm and the hidden
 * arm carries no rate at all, so a component cannot render one without its sample size.
 */
export type SuppressionVerdict =
  | {
      readonly level: "show";
      readonly rate: number;
      readonly n: number;
      readonly interval: WilsonInterval;
    }
  | {
      /** Above the floor but thin — render de-emphasised, still with `n`. */
      readonly level: "grey";
      readonly rate: number;
      readonly n: number;
      readonly interval: WilsonInterval;
    }
  | {
      /** Below the floor: the caller shows "insufficient data" and `n`. */
      readonly level: "hide";
      readonly n: number;
    };
