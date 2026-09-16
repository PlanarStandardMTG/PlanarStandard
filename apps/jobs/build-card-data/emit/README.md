# emit

**Purpose.** Turn a `PruneResult` into the three files under `data/cards/`.

**Inputs.** The prune result, plus the bulk timestamp, the fetch scope, and the run time.
**Outputs.** `buildDataset` → `CardDataset`; `serialize` → the exact bytes per filename.

**Gotchas.** `meta.setCodes` is the **fetch scope**, so it includes a set that matched no
printings — that is the signal the scope and the dataset disagree.

`oracle.json` and `printings.json` are byte-stable for unchanged input. `meta.json` is
not: `generatedAt` moves every run. E4.5 must gate its pull request on the two data
files, or the weekly job opens an empty PR every week.

Two-space JSON with a trailing newline — a set release arrives as a diff someone reads.

`pnpm --filter jobs test -- emit`
