// packages/core — pure logic only.
// MUST NEVER import from db, next, react, or @supabase/*.
// If a function needs data, it takes it as an argument.
// Modules land under core/<area>/<name>/ per §8 of the master plan
// (decklist, legality, metrics, similarity, elo, identity, stats, reddit).

// stats — presentation-safe aggregation (§8.7)
export { wilson } from "./stats/wilson/index";
export {
  aggregateBy,
  countBy,
  groupBy,
  shareOf,
  sum,
  sumBy,
} from "./stats/aggregate-by/index";
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
