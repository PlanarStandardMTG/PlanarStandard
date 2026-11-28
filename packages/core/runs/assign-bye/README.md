# assign bye

**Purpose.** Who gets the bye in a Swiss round with an odd number of players (E26.6).

**Inputs.** The current standings and the set of entrants being paired this round.

**Outputs.** `assignBye` — one entrant id, or null. `byeCandidates` — everyone, in the order to try.

**Gotchas.** Common practice, not MTR: the lowest-ranked player without a bye. A second bye
goes out only when everyone still playing has had one. `pair-swiss` moves down the
candidates when the first choice would force a rematch.

`pnpm --filter core test -- runs/assign-bye`
