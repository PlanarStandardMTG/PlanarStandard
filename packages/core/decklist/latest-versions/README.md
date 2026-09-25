# latest-versions

**Purpose.** A member's decks as one entry per deck: the newest version of each.

**Inputs.** Decks with `id` and `parentDeckId`, in any order.
**Outputs.** The decks no other deck names as a parent, in the order given, each with its version count.

**Gotchas.** An edit writes a new row rather than changing one (E20.30), so without this a deck edited
three times would be listed three times. A missing ancestor ends the count rather than failing.

`pnpm --filter core test -- latest-versions`
