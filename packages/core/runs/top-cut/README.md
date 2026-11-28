# top cut

**Purpose.** The single-elimination playoff after the Swiss rounds: who makes it, and each round's pairings (E26.8).

**Inputs.** `cutSeeds` — final Swiss standings and the cut size. `nextCutRound` — the seeds,
the entrants (for drops), the cut's pairings so far, and the round number.

**Outputs.** Seeds best first; then a round's pairings, `finished` with the champion, or `results-missing`.

**Gotchas.** Seeded 1 v 8, 4 v 5, 2 v 7, 3 v 6, with 1/8 meeting 4/5 (MTR §10.4). A cut of
any size works: the top seeds take the byes a short bracket leaves. No draws (§2.4): a
drawn result holds the round like a missing one. A drop is never replaced; the
highest-ranked remaining player gets the bye instead (§2.10).

`pnpm --filter core test -- runs/top-cut`
