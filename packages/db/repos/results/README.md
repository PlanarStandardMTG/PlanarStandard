# `repos/results`

**Purpose.** The read/write surface over the four ledger tables (E13.18) — the
import pipeline, the ledger itself, and the correction log. Every E18 import
story sits on this.

**Inputs.** A `SupabaseClient`. Which one is **not** a style choice:

| Tables                             | Client       | Why                                     |
| ---------------------------------- | ------------ | --------------------------------------- |
| `result_imports`, `staged_matches` | service-role | no read policy at all — see below       |
| `matches`, `match_corrections`     | public       | public record, scoped to the tournament |

Writes to the ledger and the correction log take the service-role client too;
role-gated writes are E14.3.

**Outputs.** `ResultImport`, `StagedMatch`, `Match`, `LedgerMatch` and
`MatchCorrection` from `@ps/contracts`. The snake_case row shape does not leave
`rows.ts`.

**Gotchas.**

- **The anon client sees staging as empty, not as forbidden.** `result_imports`
  and `staged_matches` have RLS on with no policy, which means a read returns
  `[]` and no error. Passing the public client to a staging function here is a
  bug that looks like an event with no rows, so those functions name their
  parameter `serviceClient`.
- **`listLedgerMatchesBySeason` is where ADR 003 happens.** The ledger stores
  identities; `LedgerMatch` names players. That translation is done at read time,
  here, which is exactly why a merge changes every rating and rewrites no
  history. It also orders by date, then round, then match id — Elo is
  path-dependent, so the order is a contract, and a different one is a different
  leaderboard, silently (ADR 004, E8.4).
- That sort happens in TypeScript, not in the query: PostgREST cannot order by a
  column of an embedded resource and `event_date` is one. A season is low
  thousands of matches at most, so it is cheaper than the round trip avoiding it
  would cost.
- The read returns `unresolved` alongside the matches — rows whose tournament or
  player-1 embed came back empty. Always zero against a consistent database, and
  reported rather than thrown so a replay missing matches says so instead of
  quietly rating fewer.
- Both identity embeds carry an explicit constraint hint
  (`matches!matches_p1_identity_id_fkey`). `matches` has two foreign keys into
  `player_identities` and PostgREST will not guess between them — it errors,
  which is the right failure and an opaque one to debug.
- **`replaceTournamentMatches` deletes ledger rows**, and is the only function
  here that does. It is safe because the ledger is fully derived from imports
  whose raw bytes are archived (§26): what it removes can be rebuilt. It deletes
  then inserts rather than upserting — matches carry no natural key, and a window
  showing both parses would be a leaderboard built on doubled results.
- `supersedeOtherImports` is a status change, never a delete. The old import's
  bytes and staged rows stay, because the reason to re-import is usually that the
  first parse was wrong and somebody will want to see what it said.
- `resolveStagedMatch` leaves a side alone when you omit it. Re-resolving player
  1 must not discard an operator's manual choice for player 2.
- `recordMatchCorrection` refuses a blank reason. Whitespace satisfies a
  `not null` column and explains nothing, which defeats the only purpose the
  table has (E18.6).

`pnpm --filter db test -- repos/results`
