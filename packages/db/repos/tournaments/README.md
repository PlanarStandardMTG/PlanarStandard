# `repos/tournaments`

**Purpose.** Read the site's own record of events (E13.17): one by slug, a
season's, a season's **rated** ones in replay order, the latest with results, and
one event's standings.

**Inputs.** A `SupabaseClient`. All five take the public client — every read here
is covered by a policy that hides a `draft` event, so none of them filters for
it.

**Outputs.** `Tournament` and `TournamentEntry` from `@ps/contracts`. The
snake_case row shape does not leave `rows.ts`.

**Gotchas.**

- **`listRatedTournamentsBySeason` returns oldest first, and the order is the
  contract.** Elo is path-dependent: the same matches applied in a different
  order produce different ratings, because each update is computed against what
  the previous one left behind. A descending sort would not fail anything — it
  would quietly produce a different leaderboard (ADR 004, E8.4). Ties break on
  slug so two events on one date replay reproducibly.
- `is_rated` is the ADR 006 gate. A standings-only import is recorded for
  metagame purposes and rates nothing, because pairings must never be inferred
  from placements — so it appears in `listTournamentsBySeason` and not in the
  rated list.
- **`getLatestTournamentWithResults` excludes `archived` deliberately.** Somebody
  took that event down; resurfacing it on the home page would undo that.
  `awaiting_results` is excluded because it has nothing to show. Null is the
  normal answer before the first import.
- `weight` is `numeric`, which PostgREST returns as a JSON number until it is
  wide enough to need a string. `toTournament` coerces either way: a weight that
  arrives as `"1.0"` would multiply a rating by `NaN`.
- An entry with no placement sorts **last** rather than being dropped. A
  matches-only import knows who played and not who won, and those players were
  still there.
- An entry's `record` is `0-0-0` when the columns are unset, not an absent
  record. The columns default to zero, so a null means somebody wrote one.

`pnpm --filter db test -- repos/tournaments`
