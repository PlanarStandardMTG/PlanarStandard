# deck traits

**Purpose.** Work out what the deck browser shows and filters a deck by (E20.72), so `/decks` reads it
from `deck_traits` instead of loading every list and the card data on each visit.

**Inputs.** A `ResolvedDeck` and the card index.

**Outputs.** `DeckTraits`: the maindeck's colour identity (the pips), the colours its spells cast, and
each card's normalized name.

**Gotchas.** Two different colour sets on purpose. The pips are identity with lands included, as
`color-counts` reads it; the filter's colours come from spells' **mana costs** on every board, so a land
or an off-colour activated ability does not count, and `{W/U}` and `{W/P}` count for each colour named.
Stored traits go stale only when the card data changes how a card reads; a recheck rewrites them.

`pnpm --filter core test -- deck-traits`
