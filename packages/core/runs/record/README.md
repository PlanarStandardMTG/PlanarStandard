# record

**Purpose.** Each entrant's match and game points and win–loss–draw record in a run (E26.2).

**Inputs.** The entrant ids and the run's pairings; pass Swiss pairings for Swiss standings.

**Outputs.** A `RunRecord` per entrant, zeros for one who has not played.

**Gotchas.** Only a bye or a confirmed result counts: a result one player reported and the
other has not confirmed is not in anyone's record yet. A bye is a 2–0 win, so it adds two
games to `gamesPlayed` (MTR Appendix C).

`pnpm --filter core test -- runs/record`
