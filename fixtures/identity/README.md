# `fixtures/identity`

`normalized-handles.json` is a **parity table**: one file holding both sides of a
pair, because the point of it is that two implementations agree.

`core/identity/normalize-handle` (E9.1) and the generated `normalized` column on
`player_identities` (E13.5) must produce the same string for the same handle. One
is TypeScript, the other is
`lower(regexp_replace(handle, '[^a-zA-Z0-9]', '', 'g'))` in Postgres, and neither
package may import the other — so both read this file instead.

- `packages/core/identity/normalize-handle/index.test.ts` asserts the function.
- `packages/db/generated-columns.test.ts` inserts each handle and asserts the
  column, against a local Supabase. Skipped when none is running.

A new handle that broke something goes here, and both tests pick it up.
