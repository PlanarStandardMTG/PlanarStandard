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
