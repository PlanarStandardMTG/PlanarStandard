# resolve-deck

**Purpose.** Turn a `ParsedDeck` into a `ResolvedDeck` by resolving every line's name.

**Inputs.** The parsed deck, the `CardIndex`, and `resolve-card-name`'s options.

**Outputs.** `ResolvedDeck`: one `ResolvedCard` per line, the parse issues unchanged, and
`hasUnresolvedCards`.

**Gotchas.** A miss is kept with a null `oracleId` and its candidates, never dropped and never
guessed (E18.10). Set and collector are provenance only (ADR 007).

`pnpm --filter core test -- legality`
