# check-deck-import

**Purpose.** Decide whether a pasted decklist, with its name and visibility, can be saved.

**Inputs.** `{ name, visibility, decklist }` as the form sent them, and the `CardIndex`.

**Outputs.** The trimmed name, the visibility and the `ResolvedDeck`, or every problem found:
coded, so the page words them.

**Gotchas.** Every line must parse and every name must resolve — nothing is saved that the member
did not see. Legality is not checked; a deck that breaks the format still saves, and its page says why.

`pnpm --filter core test -- legality`
