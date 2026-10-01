# known handle for name

**Purpose.** Record an entrant who joined an event with no account under the
handle the site already knows them by, from the name an organiser typed (E12.15).

**Inputs.** The event's platform, its account handles, each account-less entrant's
typed name by key, and the known identities those names and handles normalize to.

**Outputs.** Entrant key → an existing identity's handle, for the ones that match.

**Gotchas.** Exact normalized match only, as `resolve-handles`. No match, several
players, a player already in the event, or a name that collides with another
entrant's all leave the entrant out, and the caller keeps its stand-in. The
typed name is free text and may be a real name, so it is never returned.

`pnpm --filter core test -- known-handle-for-name`
