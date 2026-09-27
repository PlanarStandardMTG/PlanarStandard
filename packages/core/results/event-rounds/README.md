# event rounds

**Purpose.** Lay an event's matches out as its rounds, for the tournament page.

**Inputs.** Matches carrying `round` and `isElimination` (anything else rides along).

**Outputs.** `EventRound[]` in playing order: the round number, a label, and its matches.

**Gotchas.** The Swiss is labelled from "Round 1" in order, whatever the ledger
numbered it. A cut round is named for its match count — one is the Final, two
the Semifinals, four the Quarterfinals, otherwise "Top 2n" — so a bracket with
byes in its first round reads as a smaller cut than it was.

`pnpm --filter core test -- event-rounds`
