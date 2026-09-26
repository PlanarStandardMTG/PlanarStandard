# match-saved-deck

**Purpose.** Say which of a member's saved decks an event's list is (E18.23): the exact one, or the
nearest version of it.

**Inputs.** A list's cards, and the saved decks with theirs.
**Outputs.** `exact` — the same count of every card on every board — or `closest`, the best
weighted Jaccard over the main deck at `CLOSE_ENOUGH` or above.

**Gotchas.** Cards key on oracle id and fall back to the normalized name, so a list with a card that
did not resolve still matches itself. Basics count for `exact` and not for `closest`, as in
`deck-vector`.

`pnpm --filter core test -- match-saved-deck`
