# run details

**Purpose.** Check what an organizer typed when creating or editing a run (E26.16).

**Inputs.** The name, format versions, Swiss rounds and top cut.

**Outputs.** Null when usable, or a problem code for the form to explain.

**Gotchas.** The structure is the organizer's (§28): any count within the database's bounds
is fine, however unusual. Only no Swiss rounds with no cut is refused — nothing to play.

`pnpm --filter core test -- runs/run-details`
