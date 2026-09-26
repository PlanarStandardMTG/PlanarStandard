# match deck filter

**Purpose.** Say whether a deck passes the deck browser's colour and card-name filter (E20.40).

**Inputs.** A `ResolvedDeck`, the card index, and a `DeckFilter` of colours and names.

**Outputs.** A boolean: every chosen colour is cast and every name is in the list.

**Gotchas.** Colour is read from maindeck spells' **mana costs**, not identity, so a
land or an off-colour activated ability does not count; `{W/U}` and `{W/P}` count for
each colour named. Names match as substrings after `normalize-name`, on any board.

`pnpm --filter core test -- match-deck-filter`
