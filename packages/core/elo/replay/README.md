# replay

**Purpose.** Replay a whole match ledger into a rating table.

**Inputs.** `LedgerMatch[]` already resolved to player ids, a `RatingConfig`, and
optionally `asOf` for the activity cutoff.

**Outputs.** `ReplayResult` — the rating table, the ordered `rating_events` rows,
the anomalies, and how many matches actually moved a rating.

**Gotchas.**

- **Full recompute, never incremental** (ADR 004). Every rating is a function of
  the match stream and the config, and nothing else.
- **Matches arrive resolved to players, not handles** (ADR 003). That is what
  lets two handles merge into one rating without a row in `matches` changing.
- **It sorts its own input** by date, then round, then match id. Match ids are
  unique, so that is a total order and two runs over the same matches in any
  input order produce byte-identical output.
- **`asOf` defaults to the latest event date** in the stream. Core is pure and
  cannot ask what today is, so activity is measured against the ledger itself
  unless a caller says otherwise.
- **It never throws.** Self-play, duplicate match ids, contradictory game counts
  and impossible rating jumps come back in `anomalies` for `rating_runs.anomalies`.
  Self-play and duplicates are skipped; a bad game count is *recorded but still
  applied*, because Elo reads the result and a mis-keyed game count is no reason
  to discard a real one.
- **A counted bye marks the player present but cannot move a rating** — there is
  no opponent to be right or wrong about.

`pnpm --filter core test -- replay`
