# average-mv

**Purpose.** Average mana value, three ways.

**Inputs.** A `ResolvedDeck` and a `CardIndex`.
**Outputs.** `{ inclLands, exclLands, sideboard, totalMv }`.

**Gotchas.** Copy-weighted: four one-drops pull the average four times. An empty
board reports **null**, not zero — a deck with no sideboard has no average
sideboard mana value, and charting that as 0.0 would be a lie. "Average mana
value" unqualified normally means the excluding-lands figure.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
