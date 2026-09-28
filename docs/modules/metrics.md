# Metric definitions

**This file is the source for `/methodology`.** Everything between the
`publish:start` and `publish:end` markers below is copied verbatim into
`content/pages/methodology.mdx`; a test fails when the two disagree, and
`pnpm content:sync` resolves it. Blocks after a `publish:omit` marker stay here
and do not reach the page (E17.12, §19).

Filled in per epic. Sections marked _pending_ land with the story named.

---

<!-- publish:start -->

## Sample-size guardrails

<!-- publish:omit -->

_Module: `core/stats/suppress-small-n` (E10.3). Enforced in shared components
(ADR 012). The two hide floors come from master plan §24._

Every rate is shown with its sample size (`n`) and a 95% Wilson confidence
interval. A deck that goes 3-0 has not shown a 100% win rate: the interval on 3/3
is **[43.9%, 100%]**.

| Rate                               | Hidden below | Greyed below |
| ---------------------------------- | ------------ | ------------ |
| Win rate of decks including a card | 20 games     | 50 games     |
| Archetype win rate                 | 3 decks      | 10 decks     |
| A deck's match win rate at events  | 3 matches    | 10 matches   |

**Hidden** rates read _insufficient data_. **Greyed** rates are shown faded
because the interval is still wide.

A card's rate is labelled **"win rate of decks including this card"**. A card
does not win games; decks do.

A deck's match win rate sums every event it was played at, across all its
versions, and counts a draw as a match played and not won. It is shown next to
the record it came from.

---

## Deck metrics

<!-- publish:omit -->

_Modules: `core/metrics/*` (E6). Derived and recomputable (ADR 008)._

All counts are **copy-weighted**: four copies count four times.

### Mana curve

Maindeck non-land cards by mana value, in buckets 1–6 and 7+. Zero-cost cards
count as 1.

### Colour counts

Maindeck cards per colour of **identity**, lands included. Multicolour cards
count in each colour, so totals exceed deck size. Colourless is `C`.

### Type counts

Maindeck cards per type. Multi-type cards count under each type. Only the front
face of a multi-face card counts.

### Set attribution

Each card counts toward the legal set it comes from, not the set it was printed
in: `Llanowar Elves (M19)` counts as **FDN**. A card in two legal sets goes to the
first in the admin's legal-set order.

### Rarity counts

Maindeck cards by rarity in the legal pool. If a card has two rarities there, the
lowest is used.

### Average mana value

Three figures: with lands, without lands, and sideboard. An empty board shows no
value rather than zero.

### Unresolved cards

Copies whose names did not match a card. Decks with any are left out of card
statistics until fixed.

## Similarity

<!-- publish:omit -->

_Modules: `core/similarity/deck-vector`, `weighted-jaccard`,
`build-similarity-graph`, `force-layout` (E7). Layout coordinates travel with
`layout_version`._

Decks are compared by **weighted Jaccard** over maindeck quantities:

```
similarity = sum(min(a, b)) / sum(max(a, b))
```

Basic lands and unresolved cards are ignored. Pairs at **0.5** or above are
linked on the archetype map; at **0.85** or above they are flagged for a human as
possible duplicates, never merged automatically. The map uses a seeded layout, so
the same data always draws the same map.

<!-- publish:end -->

## Ratings

See [`ratings.md`](./ratings.md) — the source for `/ratings-explained` (E17.13).
