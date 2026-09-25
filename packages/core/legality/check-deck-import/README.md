# check-deck-import

**Purpose.** Decide whether a pasted decklist, with its name, visibility and format, can be saved.

**Inputs.** `{ name, visibility, format, decklist }` as the form sent them, and the `CardIndex`.
`readDecklist` takes the decklist alone, for checking as the member types.

**Outputs.** The trimmed name, visibility, format, the `ResolvedDeck` and every name that did not
resolve with its suggestions — or every problem found, coded, so the page words them.

**Gotchas.** Every line must parse. A name that does not resolve is **not** a problem: it comes back
as an `UnknownCard` for the member to confirm and is saved without an oracle id, since Kitchen Table
allows cards outside the dataset. Legality is not checked here; that is `check-deck-in-format`.

`pnpm --filter core test -- legality`
