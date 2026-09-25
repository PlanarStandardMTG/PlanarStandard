# melee-api

**Purpose.** Read one melee.gg event's results into a `ParsedEvent`.

**Inputs.** A `RawInput` holding the JSON the site assembles from
`lib/melee/results.server.ts`: `{ adapter: "melee-api", tournament, matches,
decklists }`, each already scrubbed to melee ids, usernames, results and cards.

**Outputs.** `matches` always; `standings`, `roster` and `decklists` when melee
has them. Standings ride on decklists, so an event nobody submitted a list for
has matches and a roster and nothing else.

**Gotchas.** Never a raw melee response — that names people and stays in
`lib/melee/` (E12.11). The handle is the melee username (E12.12); a player
without one becomes `melee-player-<id>`, which an admin can merge. Rounds are
numbered by `SortOrder`, which melee counts across phases, so a playoff replays
after the Swiss. A phase is elimination when its name says so (`Top 8
Playoffs`). A 0-0 result stages for review rather than reading as a draw.

`pnpm --filter adapters test -- melee-api`
