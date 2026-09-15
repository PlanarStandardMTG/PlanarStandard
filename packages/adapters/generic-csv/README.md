# Generic csv

**Purpose.** Import any delimited file the operator can map by hand.

**Inputs.** A `RawInput` whose `columnMapping` points source columns at
`MappableField`s. Without one, the parse returns the columns it found so the
mapping screen can offer them.

**Outputs.** A `ParsedEvent` carrying matches, standings, or both.

**Gotchas.** This is the permanent floor (§9): when a platform changes its
export and its own adapter breaks, this is what still imports the event, so it
claims broadly and the registry consults it last. **The first row is a header
only when the mapping names at least one column by name** — an all-numeric
mapping means the operator was pointing at indices because there were no
headers, and guessing either way silently shifts every row. A row whose result
cannot be read still stages, carrying a warning, because a human fixes one cell
faster than they re-upload a file. `matches` and `standings` are omitted rather
than empty: an empty `matches` array reads as "this event had no pairings",
which is how a standings-only import would go rated (ADR 006).

`pnpm --filter adapters test -- generic-csv`
