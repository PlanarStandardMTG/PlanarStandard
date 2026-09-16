// packages/core — pure logic only.
// MUST NEVER import from db, next, react, or @supabase/*.
// If a function needs data, it takes it as an argument.
// Modules land under core/<area>/<name>/ per §8 of the master plan
// (decklist, legality, metrics, similarity, elo, identity, stats, reddit).

// stats — presentation-safe aggregation (§8.7)
export { wilson } from "./stats/wilson/index";
export { aggregateBy, countBy, groupBy, shareOf, sum, sumBy } from "./stats/aggregate-by/index";
export {
  ARCHETYPE_RATE,
  CARD_WIN_RATE,
  INSUFFICIENT_DATA,
  suppressSmallN,
} from "./stats/suppress-small-n/index";
export type { SuppressionPolicy } from "./stats/suppress-small-n/index";

// elo — matches to ratings (§8.5)
export { expectedScore } from "./elo/expected-score/index";
export { kTier, pickK } from "./elo/pick-k/index";
export type { KFactorInput, KTier } from "./elo/pick-k/index";
export { applyMatch } from "./elo/apply-match/index";
export type {
  ApplyMatchInput,
  ApplyResult,
  MatchUpdate,
  PlayerSnapshot,
  SideUpdate,
  SkipReason,
} from "./elo/apply-match/index";
export { replay } from "./elo/replay/index";
export type { ReplayOptions } from "./elo/replay/index";

// decklist — text to structured deck (§8.1)
export { normalizeFaces, normalizeName } from "./decklist/normalize-name/index";
export { tokenizeLine } from "./decklist/tokenize-line/index";
export type { LineToken, TokenizeResult } from "./decklist/tokenize-line/index";
export { detectBoard, hasBoardHeader } from "./decklist/detect-board/index";
export type { BoardLine } from "./decklist/detect-board/index";
export { countBoard, parseDecklist } from "./decklist/parse-decklist/index";
export { parseFilename } from "./decklist/parse-filename/index";

// reddit — Markdown to Reddit-safe Markdown (§8.8)
export { tablesToLists } from "./reddit/tables-to-lists/index";
export { stripHtml } from "./reddit/strip-html/index";
export { absolutizeLinks } from "./reddit/absolutize-links/index";
export { imagesToLinks } from "./reddit/images-to-links/index";
export { expandChartShortcodes } from "./reddit/expand-chart-shortcodes/index";
export { toRedditMarkdown } from "./reddit/to-reddit-markdown/index";

// similarity — decks to a graph (§8.4)
export { deckVector, isBasicLand } from "./similarity/deck-vector/index";
export { sharedCardCount, weightedJaccard } from "./similarity/weighted-jaccard/index";
export {
  DEFAULT_THRESHOLD,
  DUPLICATE_THRESHOLD,
  buildSimilarityGraph,
  findDuplicateDecks,
} from "./similarity/build-similarity-graph/index";
export type { DeckEntry, GraphOptions } from "./similarity/build-similarity-graph/index";
export { forceLayout } from "./similarity/force-layout/index";
export type { LayoutNode, LayoutOptions } from "./similarity/force-layout/index";

// identity — handles to suggested merges (§8.6)
export { normalizeHandle } from "./identity/normalize-handle/index";
export type { HandleObservation, SignalContext, SignalScorer } from "./identity/signals/types";
export { parenthetical } from "./identity/signals/parenthetical/index";
export { deckFingerprint } from "./identity/signals/deck-fingerprint/index";
export { trigram, trigramSimilarity } from "./identity/signals/trigram/index";
export { containment } from "./identity/signals/containment/index";
export { temporal } from "./identity/signals/temporal/index";
export {
  coAppearanceExclusions,
  exclusionIndex,
  exclusionKey,
} from "./identity/co-appearance-exclusions/index";
export type { EventRoster } from "./identity/co-appearance-exclusions/index";
export {
  DEFAULT_MIN_CONFIDENCE,
  SIGNALS,
  scoreCandidates,
} from "./identity/score-candidates/index";
export type { Candidate, ScoreOptions } from "./identity/score-candidates/index";

// legality — deck plus rules to a verdict (§8.2)
export { buildCardIndex, normalizeSetCode } from "./legality/build-card-index/index";
export {
  MAX_CANDIDATES,
  MIN_CANDIDATE_SCORE,
  resolveCardName,
} from "./legality/resolve-card-name/index";
export type { Resolution, ResolveOptions } from "./legality/resolve-card-name/index";
export { DEFAULT_CONSTRAINTS, resolveFormat } from "./legality/resolve-format/index";
export type { FormatVersionRows } from "./legality/resolve-format/index";
export { checkCard, copyLimit, isInPool } from "./legality/check-card/index";
export type { CardUnderTest } from "./legality/check-card/index";
export { checkDeck } from "./legality/check-deck/index";

// events — an external calendar to a schedule (E23)
export { parseChallongeEvents } from "./events/parse-challonge-events/index";
export { EVENT_SYNC_INTERVAL_MS, isSyncDue, syncCutoff } from "./events/sync-window/index";
export {
  PAST_EVENT_WINDOW_MS,
  eventSchedule,
  nextEvent,
  upcomingEvents,
} from "./events/event-schedule/index";

// metrics — deck to numbers (§8.3)
export { bucketFor, manaCurve } from "./metrics/mana-curve/index";
export { colorCounts, colorIdentity } from "./metrics/color-counts/index";
export { typeCounts } from "./metrics/type-counts/index";
export { attributeCard, setAttribution } from "./metrics/set-attribution/index";
export { rarityCounts } from "./metrics/rarity-counts/index";
export { averageMv } from "./metrics/average-mv/index";
export type { AverageMv } from "./metrics/average-mv/index";
export { computeDeckMetrics } from "./metrics/compute-deck-metrics/index";
export type { ComputeOptions } from "./metrics/compute-deck-metrics/index";
