# run progress

**Purpose.** Where a run is, counted from its rows: the facts `run-state` judges a move by, and the next round's number.

**Inputs.** The run's structure and seed, its entrants, rounds and pairings.

**Outputs.** Checked-in entrants, Swiss rounds paired, unconfirmed pairings, whether the cut
has a champion, the next round number, and the pairings split into Swiss and cut.

**Gotchas.** A round's kind comes from `RunRound`, not from its number, so a run whose
structure was edited still splits correctly.

`pnpm --filter core test -- runs/run-progress`
