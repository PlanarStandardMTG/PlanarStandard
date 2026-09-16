# fixtures/auth

`role-ladder.json` — every pair of roles, and whether the first clears the bar
set by the second. All sixteen, listed rather than computed.

The ladder exists twice and has to: a route guard cannot ask Postgres, and an
RLS policy cannot ask TypeScript. `core/auth/meets-role` is one copy and
`public.has_role` (migration 0018) is the other. Two copies of one rule is worth
being nervous about, so both are pinned here — `packages/core`'s test checks the
function, `packages/db`'s `rls.test.ts` checks the database, and neither package
imports the other.

The same arrangement as `fixtures/identity/normalized-handles.json`, and for the
same reason.
