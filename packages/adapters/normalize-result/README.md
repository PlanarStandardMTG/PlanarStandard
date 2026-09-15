# Normalize result

**Purpose.** Turn a source's idea of who won into a `match_result`.

**Inputs.** `ResultCells` — a result cell, per-side game counts, or both.

**Outputs.** `NormalizedResult` — the `MatchResult` and whatever game counts
were recoverable, or `result: null` when the cell could not be read.

**Gotchas.** Game counts win over the result cell when both are mapped: they
are the more specific evidence, and a `2-1` cell disagreeing with its own
columns means the mapping is wrong, not the score. A bare `1` is deliberately
**unreadable** rather than a guess — it means "player 1 won" in one export and
"won one game" in the next, and a wrong guess writes a fabricated match into a
ledger where nothing downstream can tell it from a real one. `0-0` is a round
never played, not a draw: that is how a dropped player's remaining rounds come
out of melee. A `null` still stages the row, carrying a `ParseIssue` (§13).

`pnpm --filter adapters test -- normalize-result`
