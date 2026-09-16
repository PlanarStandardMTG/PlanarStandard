import type { Exclusion, MergeCandidate, PlayerId, Signal } from "@ps/contracts";

import { exclusionIndex, exclusionKey } from "../co-appearance-exclusions/index";
import { containment } from "../signals/containment/index";
import { deckFingerprint } from "../signals/deck-fingerprint/index";
import { parenthetical } from "../signals/parenthetical/index";
import { temporal } from "../signals/temporal/index";
import { trigram } from "../signals/trigram/index";
import type { HandleObservation, SignalContext, SignalScorer } from "../signals/types";

/**
 * Every signal, in no particular order — they are combined, not chained.
 *
 * **Adding one is a single line here plus one new file under `signals/`.** No
 * contract change, no edit to any existing signal, no change to this function's
 * body. See `packages/core/identity/README.md`.
 */
export const SIGNALS: readonly SignalScorer[] = [
  parenthetical,
  deckFingerprint,
  trigram,
  containment,
  temporal,
];

/** A handle observation together with the player it currently belongs to. */
export interface Candidate extends HandleObservation {
  readonly playerId: PlayerId;
}

export interface ScoreOptions {
  readonly signals?: readonly SignalScorer[];
  /** Candidates below this are not worth a reviewer's time. */
  readonly minConfidence?: number;
}

export const DEFAULT_MIN_CONFIDENCE = 0.3;

/**
 * Scores every pair of handles and ranks the plausible merges.
 *
 * Signals are combined with **noisy-OR**: `1 - product(1 - confidence)`. Each
 * signal is treated as independent evidence, so two weak signals together beat
 * one weak signal alone but never reach certainty, and the combination can never
 * exceed 1.
 *
 * An exclusion **zeroes** the candidate however strong the signals are (E9.8).
 * Two handles that played in the same event are not one person, and no amount of
 * name similarity changes that.
 */
export function scoreCandidates(
  candidates: readonly Candidate[],
  exclusions: readonly Exclusion[] = [],
  options: ScoreOptions = {},
): readonly MergeCandidate[] {
  const signals = options.signals ?? SIGNALS;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const excluded = exclusionIndex(exclusions);

  // Sorted so the output depends on the identities rather than on input order.
  const ordered = [...candidates].sort((a, b) =>
    a.identityId < b.identityId ? -1 : a.identityId > b.identityId ? 1 : 0,
  );

  const scored: MergeCandidate[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const a = ordered[i] as Candidate;
      const b = ordered[j] as Candidate;

      // Already the same person: nothing to merge.
      if (a.playerId === b.playerId) continue;

      const context: SignalContext = { a, b };
      const fired = signals
        .map((score) => score(context))
        .filter((signal): signal is Signal => signal !== null);
      if (fired.length === 0) continue;

      const exclusion = excluded.get(exclusionKey(a.identityId, b.identityId)) ?? null;
      const confidence = exclusion === null ? combine(fired) : 0;
      if (exclusion === null && confidence < minConfidence) continue;

      scored.push({
        playerA: a.playerId,
        playerB: b.playerId,
        confidence,
        signals: fired,
        excludedBy: exclusion,
      });
    }
  }

  return scored.sort(
    (x, y) =>
      y.confidence - x.confidence || compare(x.playerA, y.playerA) || compare(x.playerB, y.playerB),
  );
}

/** Noisy-OR over independent evidence. Never reaches 1 from signals below 1. */
function combine(signals: readonly Signal[]): number {
  let disbelief = 1;
  for (const signal of signals) {
    disbelief *= 1 - clamp(signal.confidence);
  }
  return 1 - disbelief;
}

function clamp(confidence: number): number {
  return Math.min(1, Math.max(0, confidence));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
