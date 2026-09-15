# compute-deck-metrics

**Purpose.** Compose every metric into one `deck_metrics` row.

**Inputs.** A deck id, a `ResolvedDeck`, a `CardIndex`, `FormatRules`, and the
timestamp to stamp. **Outputs.** `DeckMetrics`.

**Gotchas.** `computedAt` is an **argument**, because core has no clock and the
result must be a pure function of its inputs.

`unresolvedCards` counts **copies**, not lines, and is carried on the row rather
than recomputed downstream: a non-zero count excludes the deck from `card_stats`
until someone fixes the name (E18.10).

Definitions: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
