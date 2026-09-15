# type-counts

**Purpose.** Maindeck cards per card type.

**Inputs.** A `ResolvedDeck` and a `CardIndex`. **Outputs.** `TypeCounts`.

**Gotchas.** A multi-type card counts under **every** type it has, so these do not
sum to the deck size. Picking one "primary" type would need an arbitrary
precedence order and would make "how many creatures" wrong, which is the question
the number is for. Only the **front face** of a multi-face card is read — counting
a modal land's back face would double-count the manabase.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
