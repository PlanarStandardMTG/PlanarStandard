# moderation

**Purpose.** Decide whether an admin may change a member's role or ban them.

**Inputs.** The acting profile (id, role) and the target (id, `deletedAt`).
**Outputs.** `{ ok: true }` or `{ ok: false, problem }` — `not-admin`, `self`,
or `erased`.

**Gotchas.** No acting on yourself, so the site can never lose its last admin.
`profiles_admin_update` (migration 0019) enforces the same thing in SQL.
