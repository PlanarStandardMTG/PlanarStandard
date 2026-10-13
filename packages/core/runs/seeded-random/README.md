# seeded random

**Purpose.** The only randomness in `core/runs`: a reproducible generator and shuffle from the run's stored seed.

**Inputs.** A seed string, salted by the caller per use (`${seed}:round:3`).

**Outputs.** `seededRandom` — a generator in [0, 1). `seededShuffle` — a shuffled copy.

**Gotchas.** Changing the hash or the generator changes every stored run's round 1 and
tie order on its next read, which the pinned snapshot test exists to catch.

`pnpm --filter core test -- runs/seeded-random`
