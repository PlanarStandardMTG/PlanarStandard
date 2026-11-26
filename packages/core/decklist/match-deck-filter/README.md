# match deck filter

**Purpose.** Say whether a deck passes the deck browser's colour and card-name filter (E20.40).

**Inputs.** The deck's stored `castColors` and `cardNames` (`deck-traits`, E20.72), and a `DeckFilter`
of colours and names.

**Outputs.** A boolean: every chosen colour is cast and every name is in the list.

**Gotchas.** What counts as a cast colour, and how a name is normalized, is decided by `deck-traits`
when the deck is saved; this only compares. Names match as substrings after `normalize-name`.

`pnpm --filter core test -- match-deck-filter`
