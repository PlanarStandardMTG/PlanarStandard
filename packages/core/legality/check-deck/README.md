# check-deck

**Purpose.** A whole deck against a format.

**Inputs.** A `ResolvedDeck`, `FormatRules`, `CardIndex`.
**Outputs.** A `LegalityVerdict` — card issues and shape issues, kept apart.

**Gotchas.** **Returns every issue, never just the first.** A submitter fixing one
problem at a time across four round trips is how decklist validation earns a
reputation for being hostile.

**Copy limits count maindeck and sideboard together**, which is how Magic works
— three in the main and two in the side is five copies, not two legal piles.

**Basic lands are exempt** from the copy limit (Part IX, answer 2), and from the
singleton rule when one is in force.

The commander board is excluded from both counts; nothing in this format uses it
yet, and counting it would break the maindeck minimum if anything ever did.

`pnpm --filter core test -- legality`
