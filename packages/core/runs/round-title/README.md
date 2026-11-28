# round title

**Purpose.** What each round of a run is called on its tab and in its notifications (E26.34).

**Inputs.** The run's rounds and pairings.

**Outputs.** Round number → title: `Round 3` in Swiss; `Quarterfinals`, `Semifinals`, `Finals` for the cut's last three rounds.

**Gotchas.** Counted back from the final of the bracket the first cut round was paired with,
so the names are right before the later rounds exist. A cut of more than eight players
opens with `Round N`.

`pnpm --filter core test -- runs/round-title`
