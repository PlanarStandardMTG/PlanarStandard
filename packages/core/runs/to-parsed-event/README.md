# to parsed event

**Purpose.** A finished run as a `ParsedEvent`, so `ingest-event` commits it like any results source (E26.10, ADR 015).

**Inputs.** The run's name, date, seed and cut; its entrants, rounds and pairings; each entrant's locked decklist.

**Outputs.** A `ParsedEvent` with matches, standings, roster and decklists, platform `site`.

**Gotchas.** A guest's handle is `run-guest-<entrant id>`, never their typed name
(`runEntrantHandle`). Final placings put the cut first, by how far each player got, then
the rest by Swiss standing. An unconfirmed result stages as `null` with a warning rather
than being guessed, and an empty payload is omitted, never sent as `[]` (ADR 006).

`pnpm --filter core test -- runs/to-parsed-event`
