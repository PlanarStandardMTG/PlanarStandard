# build-similarity-graph

**Purpose.** Every deck pair above the similarity threshold, as an edge list.

**Inputs.** A season id, deck vectors, and an optional threshold (default 0.5).

**Outputs.** `SimilarityEdge[]`, plus `findDuplicateDecks` for the 0.85 case.

**Gotchas.** Pairs are emitted with `deckA < deckB` — the `deck_similarity` check
constraint — so each edge appears once and the graph is undirected. Decks are
sorted before pairing, so the output depends on the ids and not on the order the
decks arrived.

O(n²) on purpose: at ~130 decks a season that is 8,000 comparisons, and an index
would cost more to maintain than it saves.

A pair at or above 0.85 is **surfaced for a human**, never acted on
automatically — two players can legitimately register the same netdeck at one
event, and auto-merging them would delete a real result.

`pnpm --filter core test -- build-similarity-graph`
