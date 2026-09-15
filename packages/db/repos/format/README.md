# repos/format

**Purpose.** Read the format: which version is in force, what is legal under it,
what is banned, and what a deck has to look like.

**Inputs.** A Supabase client, and a `FormatVersionId` for the by-id read.

**Outputs.** `FormatVersion` and `FormatVersionDetail` — the four `format_*`
tables as rows.

**Gotchas.** Rows, not `FormatRules`: flattening is
`core/legality/resolve-format`'s job and `db` depends on contracts only, so the
caller does `resolveFormat({ ...detail })`. `getFormatDetail` by id exists
because an event played on a special pool must validate against the version it
was played under — "current" moves and the event did not. A restricted rule gets
`limit: 1` here; there is no column for it, and one is what restricted has meant
everywhere it has been used. `constraints` is null when a version has no row of
its own, and `resolve-format` then applies `DEFAULT_CONSTRAINTS`.

`pnpm --filter db test -- repos/format`
