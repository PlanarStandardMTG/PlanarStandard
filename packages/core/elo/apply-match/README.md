# apply-match

**Purpose.** Apply one match to the two players in it.

**Inputs.** The match's result, elimination flag and tournament weight; both
players' pre-match snapshots; the `RatingConfig`.

**Outputs.** `ApplyResult` — either both sides' updates, or a reason the match
carried no rating information.

**Gotchas.** Both updates are computed from the **pre-match** ratings before
either is written, so the order the two sides are processed in cannot change the
outcome. Replay has to be a pure function of the match stream, not of iteration
order, and this is where that holds.

A `double_loss` scores 0 for both — neither player gains, which is not zero-sum
and is intentional: a double loss is a penalty, not a result. A bye is never rated, whatever `countByes` says — there is no opponent to be
right or wrong about, so `countByes` governs whether _replay_ counts it as an
appearance, not whether it moves a rating. Elimination rounds are skipped per
`countEliminationRounds`. Every skip comes back as data so replay can report it
rather than silently dropping a row.

`pnpm --filter core test -- apply-match`
