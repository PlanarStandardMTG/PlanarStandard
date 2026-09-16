# normalize-name

**Purpose.** Canonicalize a card name into the key the card index is built on.

**Inputs.** A card name as a decklist spelled it.

**Outputs.** A lowercase, punctuation-free string with faces joined by `//`.
`normalizeFaces` returns the same thing split back into its faces.

**Gotchas.** Deliberately **lossy** — this is a lookup key, never something to
display. The name the player typed stays on `ParsedLine.name`.

`Sanar, Unfinished Genius / Wild Idea` and `Sanar, Unfinished Genius // Wild Idea`
normalize identically, because decklist exports write `/` where Scryfall writes
`//`. Idempotent by construction, which a test asserts over the whole fixture
corpus.

Apostrophes and dashes arrive in several Unicode flavours (a curly `Ride’s End`
against a straight `Ride's End`); NFKC plus a lookalike table folds them together
before the punctuation strip, so both land on `rides end`.

The strip is Unicode-aware (`\p{L}`, `\p{N}`), so accented names survive —
`Márton` folds to `márton`, not `mrton`.

`pnpm --filter core test -- normalize-name`
