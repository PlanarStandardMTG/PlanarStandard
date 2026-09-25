# `repos/seasons`

**Purpose.** Read and write `seasons`: the current one, the one a date falls in,
and an admin's edits (E20.35).

**Inputs.** A `SupabaseClient`. Reads take the public client; `saveSeason` takes the
admin's own, so `seasons_admin_write` decides.

**Outputs.** `Season` from `@ps/contracts`; `saveSeason` takes a `SeasonDraft`.

**Gotchas.** `getCurrentSeason` is null until an admin opens a season, and the
rating recompute (E18.12) then has nothing to rate — production gets no seeded
seasons, because `db push` never seeds. `findSeasonForDate` counts `ends_on` as
inclusive and an open-ended season as running forever. `saveSeason` re-files
tournaments by date, so an event ingested before its season existed joins it;
it does not refuse an overlap — `core/events/check-season-draft` does, before it
is called. Marking a season current un-marks the old one first, leaving a moment
with none.

`pnpm --filter db test -- repos/seasons`
