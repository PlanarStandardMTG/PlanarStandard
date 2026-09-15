import type { Signal } from "@ps/contracts";

import { normalizeHandle } from "../../normalize-handle/index";
import type { SignalContext, SignalScorer } from "../types";

/**
 * `Zaunus13 (LikoRS)` — the player wrote the pairing down themselves.
 *
 * The strongest signal there is, because it is not an inference: someone typed
 * both names next to each other. Still not 1.0, because a parenthetical is
 * sometimes a team name or a pronunciation rather than a second handle.
 */
export const CONFIDENCE = 0.95;

export const parenthetical: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  const aliasOfA = a.alias === undefined ? null : normalizeHandle(a.alias);
  const aliasOfB = b.alias === undefined ? null : normalizeHandle(b.alias);

  if (aliasOfA !== null && aliasOfA === b.handle.normalized) {
    return signal(a.handle.raw, a.alias as string, b.handle.raw);
  }
  if (aliasOfB !== null && aliasOfB === a.handle.normalized) {
    return signal(b.handle.raw, b.alias as string, a.handle.raw);
  }
  return null;
};

function signal(wroteIt: string, alias: string, matched: string): Signal {
  return {
    kind: "parenthetical",
    confidence: CONFIDENCE,
    evidence: { wroteIt, alias, matched },
  };
}
