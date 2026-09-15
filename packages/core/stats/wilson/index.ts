import type { WilsonInterval } from "@ps/contracts";

/** 95% two-sided normal quantile. The interval is always reported at 95% (§24). */
const Z = 1.959963984540054;
const Z2 = Z * Z;

/**
 * Wilson score interval on a proportion.
 *
 * Preferred over the normal approximation because it stays inside [0, 1] and
 * stays honest at the small samples this site actually has — a 3-0 archetype is
 * the common case, and the naive interval would report 100% ± 0.
 */
export function wilson(successes: number, trials: number): WilsonInterval {
  if (!Number.isFinite(successes) || !Number.isFinite(trials) || trials < 0 || successes < 0) {
    throw new RangeError(`wilson expects non-negative finite counts, got ${successes}/${trials}`);
  }
  if (successes > trials) {
    throw new RangeError(`wilson expects successes <= trials, got ${successes}/${trials}`);
  }

  // No observations constrain nothing: the honest interval is the whole range.
  if (trials === 0) return { point: 0, low: 0, high: 1, n: 0 };

  const p = successes / trials;
  const denominator = 1 + Z2 / trials;
  const centre = (p + Z2 / (2 * trials)) / denominator;
  const halfWidth =
    (Z / denominator) * Math.sqrt((p * (1 - p)) / trials + Z2 / (4 * trials * trials));

  return {
    point: p,
    low: clamp(centre - halfWidth),
    high: clamp(centre + halfWidth),
    n: trials,
  };
}

/** Rounding can push a bound a hair outside [0, 1]; a rate never lives there. */
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
