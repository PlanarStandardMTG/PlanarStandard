# meets-role

**Purpose.** Decide whether a person's role clears the bar a route or a policy
sets.

**Inputs.** The role someone has and the role something requires.
**Outputs.** `meetsRole` → boolean · `roleRank` → its rung · `isUserRole` →
a type guard for untrusted input.

**Gotchas.** The roles are a **ladder**: `reader < writer < organizer < admin`,
so an organizer may do anything a writer may. That is a decision, not a fact
about the words — it holds because the format's organizers are also the people
who write the event recaps, and a site this size does not need two grants where
one will do.

The day it stops holding — an organizer who must not publish articles, a writer
who must not touch the format tables — this becomes a set of capabilities rather
than a comparison, and **this module is the only place that has to change**.
That is the reason callers ask `meetsRole` instead of comparing roles
themselves, and the reason `roleRank` is exported rather than the table.

This is the route guards' half of the rule. The other half is RLS (E14), which
is enforced by the database and is what actually stops a write. A guard that
agrees with a policy is good UX; a guard that disagrees with one is a bug in the
guard, never a permission.

Policy: [`docs/modules/auth.md`](../../../../docs/modules/auth.md).
