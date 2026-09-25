# check-deck-in-format

**Purpose.** A deck against the format it was built for.

**Inputs.** A `ResolvedDeck`, its `DeckFormat`, the `FormatRules` in force (or null), `CardIndex`.
**Outputs.** A `LegalityVerdict`, or null when a Planar Standard deck has no rules to check against.

**Gotchas.** Kitchen Table checks nothing and is always legal — including cards the dataset does not
hold, which is why an unresolved name is not a problem there.

`pnpm --filter core test -- legality`
