# decklist-sheet

**Purpose.** Read an admin's CSV of decklists for one event into one deck per entry (E20.37).

**Inputs.** The sheet's rows (a `player` and a `deck` column, or the first two), and the event's
entries with each player's name and handles.
**Outputs.** `decks` — a player and either a saved deck's id or the list as text — and `issues`, one
per row not used, with its spreadsheet row number.

**Gotchas.** Names match on `normalize-handle`, so `Zaunus_13` finds `Zaunus 13`; a name that fits two
players is refused rather than guessed. A deck cell is a deck id, a link to `/decks/<id>`, or the list
with a card per line or `;` between cards; a link to another site is refused, never fetched.

`pnpm --filter core test -- decklist-sheet`
