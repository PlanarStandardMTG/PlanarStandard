# event slug

**Purpose.** A new tournament's `tournaments.slug`, from its name.

**Inputs.** The name as the platform sent it, and which attempt this is.

**Outputs.** A lower-case, hyphenated string; `-2`, `-3`… on a retry.

**Gotchas.** Only a new tournament gets one — a re-ingest keeps the slug it has,
so a renamed event keeps its URL. Uniqueness is the column's job; the caller
retries on a collision.

`pnpm --filter core test -- event-slug`
