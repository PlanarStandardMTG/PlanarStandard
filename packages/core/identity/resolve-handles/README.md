# resolve handles

**Purpose.** Decide, for each handle an event reported, which identity it becomes.

**Inputs.** The event's platform, its handles verbatim, and every known identity
whose normalized handle is among them (`repos/identity`'s
`listIdentitiesByNormalized`).

**Outputs.** One `HandleResolution` per distinct handle — reuse an identity,
attach a new one to an existing player, or create a player — plus `ParseIssue`s.

**Gotchas.** The only automatic link is an exact normalized match (E9.1): same
platform first, then a single player on another platform. Two players holding the
handle elsewhere is ambiguous, so it creates rather than guesses. Two handles in
one event that normalize alike are two people and get no resolution at all —
joining them would have someone play themselves. The fuzzy signals never feed
this; they only suggest merges to an admin.

`pnpm --filter core test -- resolve-handles`
