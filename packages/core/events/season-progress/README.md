# season-progress

**Purpose.** Say which month of a season a moment falls in, for the season ring on the home page and
the leaderboard.

**Inputs.** A season's `startsOn` and `endsOn` (inclusive, as `check-season-draft` has it) and `now`.

**Outputs.** `{ month, months }`: whole calendar months since the opening day, plus one, and the same
for the last day; `months` is null for a season with no end date. Null when `now` is outside the
season. Dates are read as UTC days.

`pnpm --filter core test -- season-progress`
