# player slug

**Purpose.** A new player's `players.slug`, from the handle they were first seen under.

**Inputs.** The handle verbatim, and which attempt this is.

**Outputs.** A lower-case, hyphenated string; `-2`, `-3`… on a retry.

**Gotchas.** Uniqueness is the column's job, not this function's: the caller
retries with the next `attempt` when the insert collides. A handle with nothing
URL-safe in it becomes `player`.

`pnpm --filter core test -- player-slug`
