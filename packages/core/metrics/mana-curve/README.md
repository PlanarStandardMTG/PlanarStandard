# mana-curve

**Purpose.** Maindeck mana-value histogram.

**Inputs.** A `ResolvedDeck` and a `CardIndex`. **Outputs.** `MvBuckets`.

**Gotchas.** Non-lands only — a curve is about what you cast, and lands would put
a quarter of every deck in the wrong bucket. Buckets are 1-6 and 7+, so a
zero-cost non-land falls in bucket 1; the plan's bucket list has nowhere else for
it. Copy-weighted.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md),
published verbatim at `/methodology`. Changing it means changing both in one PR.
