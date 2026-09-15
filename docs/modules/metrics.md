# Metric definitions

**This file is the source for `/methodology`.** The page publishes these
definitions verbatim, and a test asserts the two do not drift (E17.12). Changing
a definition here means changing `content/pages/methodology.mdx` in the same PR
(§19).

Filled in per epic. Sections marked _pending_ land with the story named.

---

## Sample-size guardrails

_Module: `core/stats/suppress-small-n` (E10.3). Enforced in shared components
(ADR 012)._

Every user-visible rate on this site is reported with the number of observations
behind it (`n`) and a 95% Wilson confidence interval. A rate with too few
observations is withheld rather than shown small.

### Why Wilson, and not "wins ÷ games"

At the sample sizes a community format actually produces, a bare percentage is
misleading. A deck that goes 3-0 has not demonstrated a 100% win rate; the 95%
Wilson interval on 3/3 is **[43.9%, 100%]**, which is the honest statement. The
Wilson interval is used rather than the normal approximation because it stays
inside [0, 1] and stays well-behaved at small `n`, where the normal
approximation produces bounds below 0% or above 100%.

### Thresholds

| Rate | Hidden below | Greyed below | Shown at or above |
|---|---|---|---|
| Win rate of decks including a card | 20 games | 50 games | 50 games |
| Archetype win rate | 3 decks | 10 decks | 10 decks |

- **Hidden** — no rate is rendered at all; the cell reads *insufficient data* and
  still shows `n`.
- **Greyed** — the rate is shown de-emphasised, with its interval, because the
  interval is still too wide to read as fact.
- **Shown** — rendered normally, still with `n` and its interval.

The two **hide** floors are fixed by the master plan (§24: card win rates are
suppressed under 20 games; archetype rows with n < 3 collapse to "insufficient
data"). The **grey** thresholds are a project choice, set where the 95% interval
on a 50% rate is still roughly ±13 points (n = 50) and ±26 points (n = 10)
respectively.

### Labelling

A card win rate is always labelled **"win rate of decks including this card"**,
never "card win rate". A card does not win a game; the deck around it does.
Reading the first as the second is the most common way a metagame statistic gets
misused, so the label travels with the threshold in code rather than being left
to each chart.

---

## Deck metrics

_Modules: `core/metrics/*` (E6). Every figure below is derived and fully
recomputable; no statistic is ever uploaded or hand-edited (ADR 008)._

All counts are **copy-weighted**: four copies of a card count four times, because
these describe a deck's composition rather than its card list.

### Mana curve

A histogram of maindeck **non-land** cards by mana value, in buckets **1–6 and
7+**. Lands are excluded because a curve is about what you are casting; including
them would put roughly a quarter of every deck in a bucket it does not belong to.

A zero-cost non-land falls in bucket 1 — the bucket list has nowhere else for it.
There are very few such cards in the pool; if that changes, the fix is a `0`
bucket rather than a quieter reinterpretation.

### Colour counts

Maindeck cards per colour of **identity**, not of mana cost, so a card with an
off-colour activated ability counts toward the colour the manabase actually has
to support.

A two-colour card counts once in **each** of its colours, so **these do not sum
to the deck size**. Cards with no colour identity count under `C`, which is a
bucket rather than a sixth colour. **Lands are included**, unlike in the curve: a
manabase is part of a deck's colour commitment.

### Type counts

Maindeck cards per card type: Land, Creature, Instant, Sorcery, Artifact,
Enchantment, Planeswalker, Battle.

**A multi-type card is counted under every type it has.** An Artifact Creature
adds to both, so **these do not sum to the deck size** either. The alternative —
choosing one "primary" type — needs an arbitrary precedence order and makes "how
many creatures does this deck run" wrong, which is the question the number is for.

Only the **front face** of a multi-face card is read: that is the side you cast,
and counting a modal land's back face would double-count the manabase.

### Set attribution

Each card is attributed to the set it is **legal through**, never the set it was
printed in. `Llanowar Elves (M19)` counts as **FDN**, because M19 is not in the
pool and FDN is.

This is the one that is easy to get wrong, and the reason it matters: the chart
this feeds answers "did the new set change anything", which is about which set
made a card available. A player's choice of printing has nothing to do with it.

**Tiebreak.** A card legal through two sets is attributed to whichever comes
first in the format's declared legal-set order — `format_legal_sets` as the admin
entered it. The tiebreak is therefore community-controlled rather than
alphabetical chance.

### Rarity counts

Maindeck cards by the rarity of the printing **inside the legal pool**. Rarity is
a property of a printing, not of a card, and the same card can be uncommon in one
set and rare in another. A player's promo or Secret Lair copy says nothing about
how available the card is in the format.

A card with pool printings at two rarities takes the **lowest**, which is the one
that governs how easily it is obtained.

### Average mana value

Three figures: including lands, excluding lands, and the sideboard. All
copy-weighted. "Average mana value" unqualified normally means the excluding-lands
figure.

An empty board reports **null**, not zero. A deck with no sideboard has no
average sideboard mana value, and charting that as 0.0 would be a lie.

### Unresolved cards

The number of **copies** whose card name did not resolve against the dataset. A
non-zero count excludes the deck from `card_stats` until someone fixes the name
(E18.10); the row and the deck are kept either way.

## Similarity

_Modules: `core/similarity/deck-vector`, `weighted-jaccard`,
`build-similarity-graph`, `force-layout` (E7)._

Two decks are compared by **weighted Jaccard** over their maindeck card
quantities:

```
similarity = sum(min(a, b)) / sum(max(a, b))
```

taken over the union of the two decks' cards. Weighted rather than a plain set
overlap because quantity is a deckbuilding choice: a deck on one copy of a card
is not the same deck as one on four.

**What counts.** Maindeck only. **Basic lands are excluded** — every green deck
runs Forests, so counting them makes unrelated mono-colour decks look related.
**Non-basic lands are included**, because a manabase is a real choice. Cards
whose names never resolved are excluded.

**Thresholds.** An edge is recorded at **0.5** or above. At **0.85** or above the
pair is flagged as a possible duplicate submission and shown to a human — never
merged automatically, since two players can legitimately bring the same netdeck.

**Layout.** The archetype map's coordinates come from a Fruchterman-Reingold
force layout with a **seeded** random number generator and a fixed iteration
schedule, so the same data always produces the same map. Changing the iteration
count changes every coordinate, so it travels with `layout_version`.

## Ratings

See [`ratings.md`](./ratings.md) — the source for `/ratings-explained` (E17.13).
