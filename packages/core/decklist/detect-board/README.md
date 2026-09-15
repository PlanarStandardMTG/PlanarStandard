# detect-board

**Purpose.** Classify one raw line as a blank, a comment, a board header, or a card.

**Inputs.** A single line. `hasBoardHeader` takes the whole document.

**Outputs.** A `BoardLine`. A card line carries a `board` only when the line
brought its own `SB:` prefix.

**Gotchas.** The blank-line rule needs document-level context, which is why
`hasBoardHeader` lives here too: **a file that names a board anywhere is using
headers**, so its blank lines are spacing rather than structure. Only a file with
no header at all lets a blank line open the sideboard, which is the MTGO export
convention. Without that check, a blank line between two maindeck cards would
silently move the rest of the deck to the sideboard.

Recognized headers: `SIDEBOARD:`, `Sideboard`, `Side Board`, `SB:`, `Deck`,
`Maindeck`, `Main Deck`, `Commander`, `Command Zone`, each optionally behind
`//`. A card whose *name* begins with one of those words is still a card.

`pnpm --filter core test -- detect-board`
