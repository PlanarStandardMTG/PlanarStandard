import type { DeckVector, Signal } from "@ps/contracts";

import { weightedJaccard } from "../../../similarity/weighted-jaccard/index";
import type { SignalContext, SignalScorer } from "../types";

export const CONFIDENCE = 0.9;

/**
 * Two decks this close, registered under different handles at different events,
 * are almost always one person bringing their deck back.
 */
export const MIN_SIMILARITY = 0.95;

/**
 * The same list under two handles.
 *
 * Nearly as strong as an explicit parenthetical, and the reason is that decks
 * are fingerprints: the odds of two people independently registering the same 60
 * plus the same sideboard are very low once the list has any customisation in it.
 *
 * Not 1.0, because a netdeck posted before an event genuinely does get
 * registered by several people — which is also why `build-similarity-graph`
 * refuses to auto-merge on similarity alone.
 */
export const deckFingerprint: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  let best: { similarity: number; left: number; right: number } | null = null;

  a.deckVectors.forEach((left: DeckVector, leftIndex: number) => {
    b.deckVectors.forEach((right: DeckVector, rightIndex: number) => {
      if (left.size === 0 || right.size === 0) return;
      const similarity = weightedJaccard(left, right);
      if (best === null || similarity > best.similarity) {
        best = { similarity, left: leftIndex, right: rightIndex };
      }
    });
  });

  if (best === null) return null;
  const match = best as { similarity: number; left: number; right: number };
  if (match.similarity < MIN_SIMILARITY) return null;

  return {
    kind: "deck-fingerprint",
    confidence: CONFIDENCE,
    evidence: {
      similarity: match.similarity,
      leftDeckIndex: match.left,
      rightDeckIndex: match.right,
    },
  };
};
