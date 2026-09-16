import type { DeckId, DeckVector, SeasonId, SimilarityEdge } from "@ps/contracts";

import { sharedCardCount, weightedJaccard } from "../weighted-jaccard/index";

/** Below this two decks are not meaningfully related (§8.4). */
export const DEFAULT_THRESHOLD = 0.5;

/** At or above this, two submissions are probably the same list twice (E7.5). */
export const DUPLICATE_THRESHOLD = 0.85;

export interface DeckEntry {
  readonly deckId: DeckId;
  readonly vector: DeckVector;
}

export interface GraphOptions {
  readonly threshold?: number;
}

/**
 * Every pair above the threshold, as an edge list.
 *
 * Pairs are emitted with `deckA < deckB` — the `deck_similarity` check
 * constraint — so an edge appears once and the graph is undirected. Deck ids are
 * sorted first, which makes the output order a function of the ids alone rather
 * than of the input order.
 *
 * O(n^2) and deliberately so: at ~130 decks per season that is 8,000 pairs, and
 * an index would cost more to maintain than it saves.
 */
export function buildSimilarityGraph(
  seasonId: SeasonId,
  decks: readonly DeckEntry[],
  options: GraphOptions = {},
): readonly SimilarityEdge[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const ordered = [...decks].sort((a, b) =>
    a.deckId < b.deckId ? -1 : a.deckId > b.deckId ? 1 : 0,
  );
  const edges: SimilarityEdge[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i] as DeckEntry;
    for (let j = i + 1; j < ordered.length; j += 1) {
      const b = ordered[j] as DeckEntry;
      const similarity = weightedJaccard(a.vector, b.vector);
      if (similarity < threshold) continue;
      edges.push({
        seasonId,
        deckA: a.deckId,
        deckB: b.deckId,
        similarity,
        sharedCards: sharedCardCount(a.vector, b.vector),
      });
    }
  }

  return edges;
}

/**
 * Pairs similar enough to be the same list submitted twice.
 *
 * Surfaced for a human to look at, never acted on automatically — two players
 * can legitimately register the same netdeck in one event.
 */
export function findDuplicateDecks(
  edges: readonly SimilarityEdge[],
  threshold: number = DUPLICATE_THRESHOLD,
): readonly SimilarityEdge[] {
  return edges.filter((edge) => edge.similarity >= threshold);
}
