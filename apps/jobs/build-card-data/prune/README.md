# prune

**Purpose.** Fold Scryfall's bulk rows down to the committed dataset, one row at a time.

**Inputs.** The fetch scope, then each parsed JSONL line via `accept`.
**Outputs.** `finish()` → sorted `oracle` and `printings`, `printingCountBySet`, `stats`,
and `unreachableOracleIds`.

**Gotchas.** Holds only surviving rows, so peak memory tracks the pool (~2k cards), not
the 75 MB streaming through it. `accept` never throws on a malformed row — it counts it.

`EMITTED_LAYOUTS` is `satisfies Record<Layout, boolean>` on purpose: tsc fails if the
contract's union and this list drift apart.

**`reversible_card` rows are dropped.** They carry no top-level `oracle_id`, `cmc` or
`type_line` — they cannot form a valid printing. All 11 in the pool today are alternate
printings of cards reachable elsewhere, so nothing is lost; `unreachableOracleIds` is the
assertion that this stays true. A non-empty list must fail the build.

Split-like layouts (`split`, `adventure`, `prepare`) keep the joined cost `{W} // {1}{W}`
_and_ the per-face costs, and print one image. `transform`/`modal_dfc` null the top-level
cost and image and carry both per face.

Arrays are sorted in `finish` so an unchanged input yields a byte-identical file (E4.4).

`pnpm --filter jobs test -- prune`
