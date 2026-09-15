# co-appearance-exclusions

**Purpose.** Derive the "definitely not the same person" facts from event rosters.

**Inputs.** One roster per event. **Outputs.** `Exclusion[]`, plus an index for lookup.

**Gotchas.** Two handles in one event are **never** one person — a player cannot
have played themselves. This is the hardest fact in the identity system and the
reason automatic suggestion is safe to attempt at all: it puts a floor under
every false positive the signals can produce.

Pairs come back **ordered**, `identityA < identityB`, because
`identity_exclusions` carries `check (identity_a < identity_b)`. A pair that met
at several events is recorded once, against the first.

`score-candidates` zeroes any candidate covered by one of these, and
`merge-players` refuses the merge outright (E18.16).

`pnpm --filter core test -- co-appearance-exclusions`
