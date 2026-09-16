# `@ps/adapters`

One module per results source. Every one implements `ResultsAdapter` from
`@ps/contracts` and is pure: `RawInput` in, `ParsedEvent` out (§9). No I/O, no
database, no clock — the whole file is in hand before `detect` runs.

```bash
pnpm --filter adapters test          # zero credentials, no Docker
pnpm --filter adapters test -- registry
```

| Module                                       | Role                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| `registry`                                   | which adapter reads this upload (E12.1)                 |
| `generic-csv`                                | the permanent floor: any delimited file, mapped by hand |
| `manual-entry`                               | pairings an organizer typed in                          |
| `archetype-map-html`                         | decklists out of the community archetype map            |
| `parse-csv`, `normalize-result`, `raw-input` | shared by the sources above                             |

## Writing one

Adding an adapter is the ideal first contribution: no database, no UI, no
coordination with anyone. Four steps.

**1. Drop a real export into `fixtures/<source>/`,** named for what it
exercises rather than where it came from. Committed verbatim — the BOM, the CRLF
and the lower-cased set code are the point, and anything trimmed for size is
trimmed by whole records. See [`fixtures/README.md`](../../fixtures/README.md).

**2. Scaffold the module.**

```bash
pnpm new:module adapters/melee-csv     # index.ts, index.test.ts, README.md
```

**3. Write `detect` and `parse`.** `detect` answers whether this adapter can
read the file and must not throw; the registry treats a throw as a no, but a
broken `detect` still costs you the candidate. `parse` returns a `ParsedEvent`
and **reports bad input as data rather than throwing**, so one unreadable row
never costs the rest of the file.

**4. Write the expected output beside the fixture** as
`<name>.expected.json`, and assert the pair. That test is the whole test.

Then add the adapter to `defaultRegistry` in `registry/index.ts` and export it
from `index.ts`.

## The four rules that are easy to get wrong

**Omit a payload you did not produce; never ship an empty one.** `matches: []`
reads as "this event had no pairings", which rates a standings-only import as a
complete, unremarkable event. `capabilities` says what _this parse_ produced,
not what the adapter can do.

**Never infer pairings from placements** (ADR 006). A standings sheet with every
placement and every record still does not say who played whom. A fabricated
match is indistinguishable from a real one once it is in the ledger, and every
rating downstream is quietly wrong. `capability-gating.test.ts` walks every
registered adapter and asserts this, so a new source is covered the moment it
joins the registry.

**A bye has no opponent.** Leave `p2Handle` off and set `result: "bye"` — that
is the one result the Elo replay skips. Organizers routinely record a bye as
`2-0` in the result column; those are not games that were played.

**Do not guess.** A cell you cannot read stages as `result: null` with a
`ParseIssue`, and a human fixes one cell. `normalize-result` refuses a bare `1`
for exactly this reason: it means "player 1 won" in one export and "won one
game" in the next.

## Handles, not people

Everything an adapter emits is keyed by the handle the source printed
(ADR 003). Resolution to a player happens after staging, at read time, and is
not this package's business.
