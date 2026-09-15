# weighted-jaccard

**Purpose.** Similarity between two deck vectors.

**Inputs.** Two `DeckVector`s. **Outputs.** A number in `[0, 1]`.

**Gotchas.** `sum(min) / sum(max)` over the **union**, not the intersection — a
card only the second deck runs still contributes to the denominator. Getting that
wrong quietly inflates every score.

Weighted rather than plain set Jaccard because quantity carries real information:
a deck running one copy is not playing the same deck as one running four, and set
Jaccard would score them identical.

Identical decks score 1, disjoint decks 0, and the function is symmetric. Two
empty decks score 1 rather than dividing by zero.

`pnpm --filter core test -- weighted-jaccard`
