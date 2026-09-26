# key-cards

**Purpose.** A few maindeck cards that say what a deck is — the home page's podium tiles (E24.5).

**Inputs.** A `ResolvedDeck`, a `CardIndex`, and how many (three by default). **Outputs.** Card names.

**Gotchas.** Lands and unresolved cards are left out. Most copies first, then highest mana value,
then name, so the same list always gives the same cards.
