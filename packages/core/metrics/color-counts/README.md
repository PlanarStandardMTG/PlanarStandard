# color-counts

**Purpose.** Maindeck cards per colour of identity, and the deck's colour identity.

**Inputs.** A `ResolvedDeck` and a `CardIndex`. **Outputs.** `ColorCounts`.

**Gotchas.** Identity, not mana cost, so an off-colour activated ability counts
toward the colour the manabase must support. A two-colour card counts in **both**,
so these do **not** sum to the deck size. Colourless goes under `C`, a bucket and
not a sixth colour. **Lands are included**, unlike the curve.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
