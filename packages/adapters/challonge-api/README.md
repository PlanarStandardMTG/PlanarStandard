# challonge-api

**Purpose.** Read one Challonge event's results into a `ParsedEvent`.

**Inputs.** A `RawInput` holding the JSON the site assembles from
`lib/challonge/results.server.ts`: `{ adapter: "challonge-api", tournament,
participants, matches }`, each already scrubbed to Challonge ids, usernames and
results.

**Outputs.** `matches`, `roster`, and `standings` from each participant's final
rank. Never decklists — Challonge has none; the admin's sheet brings them (E20.37).

**Gotchas.** The handle is the Challonge username; a participant without an
account goes in under `knownAs`, the handle the site already knew their typed name
as (E12.15), or else becomes `challonge-player-<id>`, never their free-text name. Where the
games and `winner_id` disagree, the winner stands and the games are left out. A
two-stage event lists its group matches and then its bracket's, which restart
round at 1 and identifier at "A"; nothing else marks the stage, so the bracket starts
at that restart and is numbered after the groups. A losers' round (negative)
sits with its winners' round. Swiss byes are not matches on Challonge, so a record
tallied from pairings misses them.

`pnpm --filter adapters test -- challonge-api`
