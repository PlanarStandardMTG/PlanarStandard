# wilson

**Purpose.** 95% Wilson score confidence interval on a proportion.

**Inputs.** `successes`, `trials` — two non-negative counts, `successes <= trials`.

**Outputs.** `WilsonInterval` — `{ point, low, high, n }`. `n` travels with the
interval so a component cannot render a rate without its sample size (ADR 012).

**Gotchas.** Wilson, not the normal approximation: it stays inside `[0, 1]` and
stays honest at n = 3, which is the common case here. A 3-0 archetype reports
`[0.44, 1.00]`, not `100% ± 0`. `trials = 0` returns the whole range `[0, 1]`
rather than throwing — no observations constrain nothing.

`pnpm --filter core test -- wilson`
