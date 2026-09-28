import type { SuppressionVerdict, WinLossDraw } from "@ps/contracts";

import { DECK_WIN_RATE, suppressSmallN } from "../suppress-small-n/index";

export interface DeckWinRate {
  /** Every event's record summed; draws are always present here. */
  readonly record: Required<WinLossDraw>;
  readonly verdict: SuppressionVerdict;
}

/**
 * A deck's match win rate over the events it was played at (E20.45). A draw
 * counts as a match played and not won, so 2-1-1 is 50%.
 */
export function deckWinRate(records: readonly WinLossDraw[]): DeckWinRate {
  const record = records.reduce<Required<WinLossDraw>>(
    (sum, r) => ({
      wins: sum.wins + r.wins,
      losses: sum.losses + r.losses,
      draws: sum.draws + (r.draws ?? 0),
    }),
    { wins: 0, losses: 0, draws: 0 },
  );
  const matches = record.wins + record.losses + record.draws;
  return { record, verdict: suppressSmallN(record.wins, matches, DECK_WIN_RATE) };
}

/**
 * Best first: a rate that may be shown ahead of one that may not, then the
 * higher rate, then more matches. Equal rates compare 0, so a stable sort
 * keeps the caller's order among them.
 */
export function compareWinRates(a: DeckWinRate, b: DeckWinRate): number {
  const rate = (v: SuppressionVerdict) => (v.level === "hide" ? -1 : v.rate);
  return rate(b.verdict) - rate(a.verdict) || b.verdict.n - a.verdict.n;
}
