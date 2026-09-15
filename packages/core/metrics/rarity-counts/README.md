# rarity-counts

**Purpose.** Maindeck cards by rarity.

**Inputs.** A `ResolvedDeck`, a `CardIndex`, and `FormatRules`.
**Outputs.** `RarityCounts`.

**Gotchas.** Rarity is a property of a **printing**, not of a card, and this reads
the printing **inside the legal pool**. A promo or Secret Lair copy says nothing
about how available the card is in the format. A card with two pool printings at
different rarities takes the **lowest**, which governs how easily it is obtained.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
