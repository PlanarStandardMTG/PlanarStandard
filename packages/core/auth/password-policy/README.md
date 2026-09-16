# password-policy

**Purpose.** Decide whether a password is acceptable, before it is sent
anywhere.

**Inputs.** The raw string. **Outputs.** `{ ok: true }`, or `{ ok: false,
problem }` where problem is `blank`, `too-short`, or `too-long`.

**Gotchas.** This is a **mirror, not the authority.** Supabase enforces
`minimum_password_length` from `packages/db/supabase.config.toml`; this exists so
somebody is told what is wrong without a round trip, and in the same words every
time. Changing one means changing the other, and the constant here says so.

The maximum is 72 **bytes**, which is not a policy choice — bcrypt hashes the
first 72 bytes and ignores the rest. A longer password is not a stronger one,
and two passphrases with a long shared prefix would be the same password. It is
refused rather than truncated, because a truncated password is not the password
somebody typed. Measured in bytes and not characters: an emoji is four of the
72 and one of `String.length`'s.

No complexity rules — no "one number, one symbol". They push people towards
`Password1!` and away from length, which is the thing that actually helps.

Policy: [`docs/modules/auth.md`](../../../../docs/modules/auth.md).
