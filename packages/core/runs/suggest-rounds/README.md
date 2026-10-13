# suggest rounds

**Purpose.** The Swiss rounds and top cut to prefill when an organizer sets up a run (E26.7).

**Inputs.** The number of entrants.

**Outputs.** A `RunStructure`.

**Gotchas.** MTR Appendix E's constructed column from 9 entrants up. Below that it would run
straight single elimination; we suggest three Swiss rounds and no cut instead (§28), and one
round for two players. It is only a prefill: any value the organizer types is allowed.

`pnpm --filter core test -- runs/suggest-rounds`
