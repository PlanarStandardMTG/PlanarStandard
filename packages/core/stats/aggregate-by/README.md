# aggregate-by

**Purpose.** Group a flat list of rows by a key and fold each group.

**Inputs.** Any iterable, a key function, and either a value function or a
seed/fold pair.

**Outputs.** A `Map` keyed by whatever the key function returned.

**Gotchas.** Maps rather than records, because the keys are branded ids
(`OracleId`) that a record would stringify. `aggregateBy` calls `seed` once per
key rather than taking a shared initial value, so a mutable accumulator cannot
leak between groups. `shareOf` returns an empty map when the total is zero — a
share of nothing is undefined, and rendering it as 0% is a lie.

`pnpm --filter core test -- aggregate-by`
