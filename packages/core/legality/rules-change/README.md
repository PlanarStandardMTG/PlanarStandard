# rules change

**Purpose.** Say which way an admin's edit to a format version moved its rules (E20.72), so stored deck
legality is marked out of date only when a legal deck could have become illegal.

**Inputs.** The version's `FormatRules` before and after the save.

**Outputs.** `{ narrowed, widened }`. Narrowed: a set left the pool, a card was banned or restricted
further or lost its exception, or a deck-size or copy limit tightened. Widened is the reverse of each.

**Gotchas.** Both can be true at once: a rotation adds sets and removes others. It compares rules only;
a change to the card data itself is not seen here.

`pnpm --filter core test -- rules-change`
