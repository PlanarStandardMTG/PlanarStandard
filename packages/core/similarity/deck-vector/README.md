# deck-vector

**Purpose.** Turn a resolved deck into the card-to-quantity map similarity compares.

**Inputs.** A `ResolvedDeck`. **Outputs.** `DeckVector` — `ReadonlyMap<OracleId, number>`.

**Gotchas.** **Maindeck only, basics excluded, non-basic lands kept.** Basics
carry no information about what a deck is doing — every green deck runs Forests —
so leaving them in makes two unrelated mono-colour decks look related. Non-basic
lands stay because a manabase *is* a deckbuilding choice.

Basics are detected by normalized name rather than by type line, so this module
needs no card index. It is the only closed set of card names in the game; the
snow variants are the only additions in a decade.

Unresolved cards are dropped. Without an oracle id there is nothing to compare
across decks, and falling back to raw names would make a typo look like a
different card.

`pnpm --filter core test -- deck-vector`
