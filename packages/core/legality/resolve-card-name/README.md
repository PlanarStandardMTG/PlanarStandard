# resolve-card-name

**Purpose.** A printed decklist name to an oracle id.

**Inputs.** The name, the `CardIndex`, optional score floor and candidate cap.
**Outputs.** A hit, or a miss carrying ranked "did you mean" candidates.

**Gotchas.** **An exact match always wins.** Fuzzy matching only runs when the
normalized name is absent from the index entirely, so a real card can never be
displaced by a better-scoring neighbour.

**A miss returns candidates, never the best of them.** Picking one would put a
card the player did not register into their deck, and a wrong card is worse than
an unresolved one — E18.10 keeps the row, flags the deck, and excludes it from
`card_stats` until a human fixes it.

The trigram similarity here is a deliberate local copy of the one in
`core/identity/signals/trigram`. Legality has no business depending on identity,
and ten lines of a standard algorithm is cheaper than that coupling.

`pnpm --filter core test -- legality`
