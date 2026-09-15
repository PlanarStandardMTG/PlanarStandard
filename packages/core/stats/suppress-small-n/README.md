# suppress-small-n

**Purpose.** Decide whether a rate has enough observations behind it to be shown,
greyed, or withheld.

**Inputs.** `successes`, `trials`, and a `SuppressionPolicy`. Two policies ship:
`CARD_WIN_RATE` (hide under 20 games) and `ARCHETYPE_RATE` (hide under 3 decks).
Both floors are pinned by the master plan; the grey thresholds are a project
choice, documented in `docs/modules/metrics.md`.

**Outputs.** `SuppressionVerdict` — a union whose `hide` arm carries **no rate at
all**, only `n`. That is the enforcement: a component cannot render a rate
without its sample size, because on the suppressed arm there is no rate to render.

**Gotchas.** Takes counts, never a precomputed rate — a caller that already
divided has discarded the denominator, which is the thing being judged.
`policy.label` travels with the policy because §24 makes the card label
non-negotiable: "win rate of decks including this card", never "card win rate".

Every user-visible rate on the site goes through this (ADR 012, §19), and
`E19.14` is a lint test asserting every rate-displaying component imports it.

`pnpm --filter core test -- suppress-small-n`
