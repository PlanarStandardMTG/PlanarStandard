# pair swiss

**Purpose.** The next Swiss round's pairings (E26.5), by common practice: MTR §10.4 names Swiss without defining it.

**Inputs.** The run's entrants, every Swiss pairing posted so far, its seed, and the round number.

**Outputs.** `{ ok: true, pairings }` — tables in order, top first, a bye last — or `{ ok: false, reason }`.

**Gotchas.** Ordered by match points and shuffled within each point group by the seed, so
round 1 is random and every re-pair reproduces. Pairs top down with backtracking: an odd
group pairs down, and nobody plays the same opponent twice. When no rematch-free pairing
exists it returns `no-pairing-without-rematch` and the organizer decides; it never
returns a bad pairing. A drop counts from the next round paired (MTR §2.10).

`pnpm --filter core test -- runs/pair-swiss`
