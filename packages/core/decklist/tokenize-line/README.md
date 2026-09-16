# tokenize-line

**Purpose.** Turn one decklist line into its parts.

**Inputs.** A single line of text. Board headers and blank lines are
`detect-board`'s job and must be filtered out before a line reaches here.

**Outputs.** `{ ok: true, token }` where token is
`{ qty, name, set?, collector?, foil }`, or `{ ok: false, code, column, message }`
with a 1-based column so the submitter can be shown what broke.

**Gotchas.** `set` and `collector` are **omitted**, never set to `undefined` —
the contract compiles with `exactOptionalPropertyTypes`, and 321 distinct real
lines carry no printing at all.

Collector numbers stay **strings**. `11p`, `72s`, `KLD-5`, `M19-54`, `ml233` and
`9★` are all real values from the corpus; parsing them as numbers loses them.

A lower-case `(fdn)` is left lower-case. Normalizing belongs to the index
lookup, not the tokenizer.

Only a _trailing_ `(SET) COLLECTOR` pair is read as a printing, so
`1 Cathar Commando (FDN)` — a parenthesis with no collector after it — keeps the
parenthesis as part of the name rather than guessing.

`pnpm --filter core test -- tokenize-line`
