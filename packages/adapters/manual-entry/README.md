# Manual entry

**Purpose.** Import pairings an organizer typed in.

**Inputs.** A `RawInput` holding the entry form's JSON: event metadata and a
`matches` array of `{ round, table, p1, p2, result }`.

**Outputs.** A `ParsedEvent` with `matches`, and whatever event metadata the
form carried.

**Gotchas.** The payload must carry `"adapter": "manual-entry"`. This is the one
input the site generates itself, so it can label itself — and that is what stops
this adapter claiming the next JSON source somebody adds. Matches only, by
design: standings a human typed are standings somebody derived from pairings
they already had, and those pairings are what Elo needs (ADR 006). A pairing
with no `p2` is a bye. `raw` keeps only the scalar fields, because
`staged_matches.raw` is flat (§13).

`pnpm --filter adapters test -- manual-entry`
