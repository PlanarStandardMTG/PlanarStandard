# `repos/seasons`

**Purpose.** Read `seasons`: the current one, and the one a date falls in.

**Inputs.** A `SupabaseClient`; the public client is enough, every season is readable.

**Outputs.** `Season` from `@ps/contracts`.

**Gotchas.** `getCurrentSeason` is null until an admin opens a season, and the
rating recompute (E18.12) then has nothing to rate — production gets no seeded
seasons, because `db push` never seeds. `findSeasonForDate` counts `ends_on` as
inclusive and an open-ended season as running forever, so an event between two
seasons belongs to neither.

`pnpm --filter db test -- repos/seasons`
