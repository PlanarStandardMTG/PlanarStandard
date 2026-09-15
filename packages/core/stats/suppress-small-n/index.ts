import type { SuppressionVerdict } from "@ps/contracts";

import { wilson } from "../wilson/index";

/**
 * Sample-size discipline, enforced in code rather than remembered per page
 * (ADR 012, §19). Every user-visible rate on the site goes through this, and the
 * returned verdict carries `n` on every arm so a component physically cannot
 * render a rate without its sample size.
 */
export interface SuppressionPolicy {
  /** Below this many observations the rate is not shown at all. */
  readonly hideBelow: number;
  /** Shown but de-emphasised below this — the interval is still too wide to read as fact. */
  readonly greyBelow: number;
  /** How this rate must be labelled wherever it appears. */
  readonly label: string;
}

/** What a hidden cell says instead of a number. */
export const INSUFFICIENT_DATA = "insufficient data";

/**
 * A card does not win games, the deck around it does — so this is never labelled
 * "card win rate" (§24). The 20-game floor is pinned by the plan; the grey band
 * runs to 50, where the 95% interval on a 50% rate is still about ±13 points.
 */
export const CARD_WIN_RATE: SuppressionPolicy = {
  hideBelow: 20,
  greyBelow: 50,
  label: "win rate of decks including this card",
};

/**
 * Archetype rows. The n < 3 floor is pinned by the plan — 45 archetypes over 98
 * decks means most rows are a single pilot. The grey band runs to 10, where the
 * interval on a 50% rate is still about ±26 points.
 */
export const ARCHETYPE_RATE: SuppressionPolicy = {
  hideBelow: 3,
  greyBelow: 10,
  label: "win rate",
};

/**
 * Decides whether a rate may be shown, and returns it together with its interval
 * and its `n`.
 *
 * Takes counts rather than a precomputed rate: a caller that already divided has
 * thrown away the denominator, which is the thing being judged.
 */
export function suppressSmallN(
  successes: number,
  trials: number,
  policy: SuppressionPolicy,
): SuppressionVerdict {
  if (trials < policy.hideBelow) return { level: "hide", n: trials };

  const interval = wilson(successes, trials);
  const level = trials < policy.greyBelow ? "grey" : "show";
  return { level, rate: interval.point, n: trials, interval };
}
