# force-layout

**Purpose.** Lay the similarity graph out in two dimensions.

**Inputs.** The edge list, the deck ids, and optionally a seed, an iteration
count and a size.

**Outputs.** One `{ deckId, x, y }` per deck, normalized into a centred square.

**Gotchas.** **Reproducibility is the whole point.** The same edges and the same
seed must produce byte-identical coordinates on every run and every machine, or
the archetype map rearranges itself on every recompute and nobody can say "that
deck, over on the left". Three things hold that, all load-bearing:

- a seeded PRNG (mulberry32), never `Math.random`
- nodes sorted by deck id, so input order cannot leak in
- **only `+ - * /` and `Math.sqrt`** — IEEE 754 pins those exactly. `Math.pow`,
  `exp` and the trigonometric functions are implementation-defined to the last
  bit and would differ between JS engines. A test reads this file and fails if
  one appears.

The cooling schedule is linear over a fixed iteration count, which makes the
iteration count part of the output: changing it changes every coordinate, so
bump `deck_map_layout.layout_version` when you do.

`pnpm --filter core test -- force-layout`
