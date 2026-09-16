# `repos/archetypes`

**Purpose.** Read the vocabulary the metagame is described in (E13.23): the
archetype list, one archetype by id, and the label-to-archetype lookup every
import needs.

**Inputs.** A `SupabaseClient`. All three reads take the public client — the
metagame is the site's whole subject and the words it is reported in are not a
secret. Admin writes are E14.4; the editor is E20.18.

**Outputs.** `Archetype` and `ArchetypeWithAliases` from `@ps/contracts`. The
snake_case row shape does not leave `rows.ts`.

**Gotchas.**

- **`findArchetypeByAlias` returning null is a normal answer.** An unrecognised
  label leaves the deck with its `archetype_raw` and no `archetype_id` until
  somebody adds the alias — and re-resolving then fixes every deck that ever
  carried it. Guessing would put a wrong archetype into the metagame numbers,
  which is worse than a missing one.
- It tries the **aliases first, then the archetype's own name**, because a name
  is obviously a spelling of itself and the vocabulary does not register it as an
  alias. The alias path ignores punctuation, spacing and case; the name path only
  ignores case, because `archetypes.name` has no normalized column. When a source
  needs a punctuated form of a name, the fix is to register it as a real alias.
- The label is escaped before it reaches `ilike`. `%` and `_` are pattern syntax,
  so an unescaped one matches every row and `maybeSingle` errors rather than
  missing.
- **`normalizeAlias` duplicates a generated column.** Postgres computes
  `archetype_aliases.normalized` on write, and the TypeScript in `rows.ts` has to
  produce the same string or lookups silently stop matching. It is duplicated
  rather than imported from `core` because `db` depends on contracts only, and
  the test at the bottom of `index.test.ts` asserts the two against every seeded
  alias — the same arrangement `core/identity/normalize-handle` has with
  `generated-columns.test.ts`.
- `listArchetypes` is `is_active` only unless asked otherwise, and the whole
  table is small — five rows today, a few dozen at worst. A caller resolving many
  labels at once should take the list and match in memory rather than calling
  `findArchetypeByAlias` in a loop.

`pnpm --filter db test -- repos/archetypes`
