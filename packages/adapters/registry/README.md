# Registry

**Purpose.** Decide which adapter reads an upload.

**Inputs.** A `RawInput` and a registry (the shipped one by default).

**Outputs.** `AdapterDetection` — matched, ambiguous, or unrecognized, the last
two carrying an actionable `ParseIssue`.

**Gotchas.** Registration order never decides a winner (E12.1): two claimants
are reported as `ambiguous` for the operator to resolve, because the wrong
adapter on a real export produces plausible pairings that are not the ones that
were played. `generic-csv` is marked `fallback` and consulted only once no
specific adapter has claimed the file — it reads any delimited text, so without
that it would be ambiguous with every CSV source in §9's table. That is a
declared role, not a position in the list. A `detect` that throws is treated as
a no, since a broken adapter must not cost the upload its other candidates.

`pnpm --filter adapters test -- registry`
