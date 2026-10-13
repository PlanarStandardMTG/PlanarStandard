# `repos/runs`

Reads and writes over the run tables: `tournament_runs`, `tournament_run_formats`,
`run_entrants`, `run_guest_contacts`, `run_rounds`, `run_pairings` and
`run_result_changes` (E26.14, §28).

**Inputs.** The caller's own `SupabaseClient`. Every write goes through it, so the
policies and the result guard in migrations 0048–0051 decide who may do what.
`linkRunTournament` alone takes the service-role client.

**Outputs.** `Run`, `RunEntrant`, `RunRound`, `PostedRunPairing` and `RunResultChange`
from `@ps/contracts`. The snake_case rows stay in `rows.ts`.

**Gotchas.**

- Whether a move is allowed is `core/runs`'s call, made before these are called:
  `setRunState` stores a state, it does not judge one.
- `postRunRound` is one transaction (0051). Posting a round number again re-pairs it,
  and the database refuses once a result is in.
- A result counts only when confirmed. `reportRunResult` is a player's word,
  `confirmRunResult` the other player's agreement, `setRunResult` the organizer's
  ruling; the trigger logs each with who made it.
- `getEntrantArenaUsername` returns null both for "none set" and "not yours to see".
