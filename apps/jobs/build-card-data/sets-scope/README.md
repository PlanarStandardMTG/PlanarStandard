# sets-scope

**Purpose.** Validate `data/sets.json` — the fetch scope — and lower-case it.

**Inputs.** The parsed JSON, as `unknown`.
**Outputs.** `{ ok: true, setCodes }` lower-cased in file order, or `{ ok: false, issues }`
listing every problem at once.

**Gotchas.** This is the **fetch scope**, not the legal pool. `data/sets.json` says what
the committed dataset contains and changes by PR; `format_legal_sets` says what is legal
and is admin-edited, so a B&R announcement needs no deploy (§14.1).

The file is written upper-case (`FDN`) because that is how a human and the seed SQL write
a set code; every lookup is lower-case, so the conversion happens once, here.

Order is preserved, not sorted — the file reads in release order. Sorting for byte-stable
diffs happens in the emitted artifact, not the input.

`pnpm --filter jobs test -- sets-scope`
