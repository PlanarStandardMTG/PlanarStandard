# match deck filter

**Purpose.** Say whether a deck passes the deck browser's colour, card-name and creator filter (E20.40,
E20.73).

**Inputs.** The deck's stored `castColors` and `cardNames` (`deck-traits`, E20.72), the name the deck is
credited to, and a `DeckFilter` of colours, names and a creator.

**Outputs.** A boolean: every chosen colour is cast and every name is in the list, and the creator is in
the author's name.

**Gotchas.** What counts as a cast colour, and how a name is normalized, is decided by `deck-traits`
when the deck is saved; this only compares. Names and the creator match as substrings after
`normalize-name`; an uncredited deck fails any creator.

`pnpm --filter core test -- match-deck-filter`
