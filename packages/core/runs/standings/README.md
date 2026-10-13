# standings

**Purpose.** A run's Swiss standings, derived on every read and never stored (E26.4, ADR 004).

**Inputs.** The run's entrants, its Swiss pairings, and its seed.

**Outputs.** `RunStanding[]` in rank order: match points, then the three tiebreakers (MTR §3.1).

**Gotchas.** An exact tie falls to a draw from the seed, so it never flips between reads. A
dropped entrant keeps their place, marked `dropped`; one who dropped before round 1, or was
never checked in and never paired, is not listed (MTR §2.10). Pass Swiss pairings only.

`pnpm --filter core test -- runs/standings`
