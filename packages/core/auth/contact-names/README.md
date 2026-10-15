# contact names

**Purpose.** Validate the Arena username and Discord name a member puts on their profile (E26.15).

**Inputs.** The two fields as typed.

**Outputs.** The values to store, null for an empty field, or a problem code for the form to explain.

**Gotchas.** An Arena username needs its `#` tag, because a Direct Challenge does. These
are private contact details (§28), never handles: nothing in the ledger matches on them.

`pnpm --filter core test -- auth/contact-names`
