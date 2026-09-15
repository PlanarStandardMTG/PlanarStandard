import type { Signal } from "@ps/contracts";

import type { SignalContext, SignalScorer } from "../types";

/** The signal's weight when it fires. The measured similarity rides in the evidence. */
export const CONFIDENCE = 0.6;

/** Below this, two handles share a few letters by coincidence and nothing more. */
export const MIN_SIMILARITY = 0.4;

/**
 * Trigram similarity between two normalized handles — `Dreamsalong` against
 * `DreamsAlong`, or a handle carried across platforms with a typo.
 *
 * The confidence is flat at 0.6 whenever it fires, rather than scaled by the
 * measured similarity. A signal's confidence is how much that *kind* of evidence
 * is worth; how strong this instance was belongs in the evidence, where a
 * reviewer can see it.
 */
export const trigram: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  const left = a.handle.normalized;
  const right = b.handle.normalized;
  if (left.length === 0 || right.length === 0 || left === right) return null;

  const similarity = trigramSimilarity(left, right);
  if (similarity < MIN_SIMILARITY) return null;

  return {
    kind: "trigram",
    confidence: CONFIDENCE,
    evidence: { left, right, similarity },
  };
};

/** Jaccard over trigram sets, padded so short handles still produce grams. */
export function trigramSimilarity(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.add(padded.slice(i, i + 3));
  return grams;
}
