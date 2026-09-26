# merge blockers

**Purpose.** Name the events that prove two players are two people.

**Inputs.** Each player's identity ids, and which identities played in which
tournament (`repos/identity`'s `listIdentityAppearances`).

**Outputs.** The tournament ids where a handle of each played; empty when the
merge may go ahead.

**Gotchas.** The co-appearance rule (E9.7), which also zeroes a
merge suggestion, asked of every event rather than once per pair of handles. An admin cannot override it: nobody plays themselves, so a
merge that would make someone do so is wrong however sure the admin is. One
player's own handles meeting each other is not a blocker.

`pnpm --filter core test -- merge-blockers`
