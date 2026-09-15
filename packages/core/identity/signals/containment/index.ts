import type { Signal } from "@ps/contracts";

import type { SignalContext, SignalScorer } from "../types";

/** `Liko` inside `LikoRS`. Weak on its own — plenty of short handles nest by chance. */
export const CONFIDENCE = 0.55;

/**
 * Below this a containment is noise: `al` is inside half the handles in the
 * ledger, and firing on it would bury the queue in false pairs.
 */
export const MIN_LENGTH = 4;

export const containment: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  const left = a.handle.normalized;
  const right = b.handle.normalized;
  if (left === right) return null;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < MIN_LENGTH) return null;
  if (!longer.includes(shorter)) return null;

  return {
    kind: "containment",
    confidence: CONFIDENCE,
    evidence: { shorter, longer, position: longer.indexOf(shorter) },
  };
};
