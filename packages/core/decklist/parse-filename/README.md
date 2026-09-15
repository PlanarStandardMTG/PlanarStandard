# parse-filename

**Purpose.** Read the metadata a decklist filename encodes.

**Inputs.** A filename, with or without its extension.

**Outputs.** `DecklistFilenameMeta` — player, alias, deck name, archetype, and
the two records. Everything after the player is optional.

**Gotchas.** The separator is a **fullwidth** vertical line `｜` (U+FF5C), not
ASCII `|`, because `|` is illegal in a filename on Windows. Files also come back
with every separator rewritten to `_` by the OS or by a download, so that form is
accepted too — which means a player whose handle contains an underscore will
mis-split. Known and accepted; the fullwidth form is the one to prefer.

Records are identified **by shape, not by position**: a three-part segment is the
match record (`W-L-D`), a two-part one the game record (`GW-GL`). That is what
lets `Player｜Deck｜3-0-0｜6-2`, which has no archetype, parse correctly instead
of reading `3-0-0` as the archetype.

The trailing `(alias)` is split off the player segment into its own field,
because `core/identity/signals/parenthetical` (E9.2) mines it — `Zaunus13 (LikoRS)`
and `divnyi (Mika)` are explicit identity pairings already sitting in the data.
It appears both with and without a space before the parenthesis.

`pnpm --filter core test -- parse-filename`
