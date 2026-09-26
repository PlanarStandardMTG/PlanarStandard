# event entries

**Purpose.** Turn a parsed event into one standing per player, for `tournament_entries`.

**Inputs.** A `ParsedEvent`'s `matches` and `standings`.

**Outputs.** `EventEntry[]`: handle, placement or null, record, dropped.

**Gotchas.** Placements are the source's when it reported any. Without them, a
clean single-elimination playoff gives the top finishers (1, 2, then 3 shared,
5 shared); anything messier gives none. That reads finishes off pairings, never
pairings off finishes (ADR 006). A record the source did not report is tallied
from the pairings, a bye counting as a win.

`pnpm --filter core test -- event-entries`
