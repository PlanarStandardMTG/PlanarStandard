import type { Signal } from "@ps/contracts";

import type { SignalContext, SignalScorer } from "../types";

/**
 * One handle stopped appearing before the other started.
 *
 * Consistent with a rename, but equally consistent with two people who simply
 * never overlapped, which is why it is the weakest signal in the set. It is
 * useful as a tiebreaker on top of a stronger signal, not on its own.
 */
export const CONFIDENCE = 0.3;

export const temporal: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  const aDates = [...a.eventDates].sort();
  const bDates = [...b.eventDates].sort();
  if (aDates.length === 0 || bDates.length === 0) return null;

  const aLast = aDates[aDates.length - 1] as string;
  const aFirst = aDates[0] as string;
  const bLast = bDates[bDates.length - 1] as string;
  const bFirst = bDates[0] as string;

  if (aLast < bFirst) return signal(a.handle.raw, aLast, b.handle.raw, bFirst);
  if (bLast < aFirst) return signal(b.handle.raw, bLast, a.handle.raw, aFirst);
  return null;
};

function signal(earlier: string, lastSeen: string, later: string, firstSeen: string): Signal {
  return {
    kind: "temporal",
    confidence: CONFIDENCE,
    evidence: { earlier, lastSeen, later, firstSeen },
  };
}
