# season-progress

**Purpose.** Say which week of a season a moment falls in, for the season ring in the header and on
the leaderboard.

**Inputs.** A season's `startsOn` and `endsOn` (inclusive, as `check-season-draft` has it) and `now`.

**Outputs.** `{ week, weeks }`, with `weeks` null for a season with no end date; null when `now` is
outside the season. Dates are read as UTC days.

`pnpm --filter core test -- season-progress`
