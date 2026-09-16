# `repos/ratings`

**Purpose.** Read and write the rating tables (E13.20): the config every K comes
from, the leaderboard, one player's standing and history, and the single write a
recompute makes.

**Inputs.** A `SupabaseClient`. The reads take the public client and are covered
by policies that follow the player's visibility. `replaceRatings`,
`recordRatingRun` and `listRatingRuns` take the **service-role** client —
`rating_runs` has no read policy at all.

**Outputs.** `RatingConfig`, `LeaderboardRow`, `PlayerRating`, `RatingEvent` and
`RatingRun` from `@ps/contracts`. The snake_case row shape does not leave
`rows.ts`.

**Gotchas.**

- **There is one write, and that is the design.** `replaceRatings` takes a whole
  replay and replaces everything. There is no function here that moves one
  player's rating, because ADR 004 says full recompute and never incremental —
  and an API that offered both would make the leaderboard depend on the order
  somebody happened to call things in.
- It is **not atomic**: PostgREST has no transaction across two tables, so there
  is a window where ratings are cleared. That is acceptable here in a way it is
  not for the ledger — everything being deleted is derived, the inputs are
  untouched, and a failed recompute is fixed by running it again.
- **`getLeaderboard` reads the view, not `player_ratings`.** Who qualifies —
  public, unmerged, past provisional, over the configured match threshold — is
  answered in one place. A caller filtering the table by hand is a second answer,
  and the two disagree eventually. Ties break on slug so equal ratings are in a
  stable order.
- A provisional player has a rating and is not on the leaderboard.
  `getPlayerRating` still returns it: they are off the board, not unrated.
- A hidden player is absent from the read entirely, not merely from the view.
  Their matches still moved everyone else's numbers.
- **Every `numeric` goes through `Number`.** PostgREST returns them as JSON
  numbers until a value is wide enough to need a string, and a rating that
  arrives as `"1712.5"` sorts as text and renders as text without ever throwing.
  This is not defensive tidying; it is the reason a leaderboard cannot silently
  order itself alphabetically.
- `recordRatingRun` is written whether the run was clean or not. A run that found
  four self-play anomalies and applied everything else is exactly the one
  somebody will want to find later (E8.5).

**Testing note.** This suite writes matches, and so does `repos/results`. Test
files run in parallel and `replaceTournamentMatches` clears a whole tournament's
matches by design, so the two claim **different seeded events** — `weekly-38`
here, `weekly-40` and `community-showcase` there. Sharing one produces a
foreign-key violation in whichever suite loses the race.

`pnpm --filter db test -- repos/ratings`
