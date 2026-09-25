# deck-sections

**Purpose.** Split a deck into the sections it is read in — maindeck by card type, then the sideboard.

**Inputs.** Cards carrying `qty` and `board`, and a function giving each one's type line (null when
the name never resolved).

**Outputs.** Non-empty sections in reading order, each with its cards and its copy count.

**Gotchas.** One section per card, by the front face and a fixed precedence: land before creature
before everything else. An unresolved card goes in `unknown`, never a guessed section.

`pnpm --filter core test -- deck-sections`
