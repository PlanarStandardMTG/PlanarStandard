# set-attribution

**Purpose.** Attribute each maindeck card to the set it is legal through.

**Inputs.** A `ResolvedDeck`, a `CardIndex`, and `FormatRules`.
**Outputs.** `SetCounts`.

**Gotchas.** **The subtle one.** A card is attributed to its **legal** set, never
its printed one: `Llanowar Elves (M19)` counts as FDN. The chart this feeds
answers "did the new set change anything", which is about what made a card
available — a player's choice of printing has nothing to do with it.

**Tiebreak:** a card legal through two sets takes whichever comes first in the
format's declared legal-set order, so the tiebreak is community-controlled rather
than alphabetical chance.

Definition: [`docs/modules/metrics.md`](../../../../docs/modules/metrics.md).
