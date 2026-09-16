# repos/profiles

**Purpose.** The reads and writes over `profiles` — who is signed in, what they
are called, and what they are allowed to do.

**Inputs.** A Supabase client and an auth id or handle. **Outputs.** `Profile`,
or null where the question has no answer.

**Gotchas.** Nothing here inserts. Profiles are created by migration 0016's
trigger on `auth.users`, so the row exists before the site could ask for it, and
a signed-in visitor without one is a bug rather than a case to handle. `role` is
never writable from here — a role grant is admin-only (E14.4), and omitting the
column is how that stays true outside RLS too. `updateProfile` runs under the
caller's own client on purpose: `profiles_self_update` is the check, and the
`id` argument is not a substitute for it.

Policy: [`docs/modules/auth.md`](../../../../docs/modules/auth.md).
