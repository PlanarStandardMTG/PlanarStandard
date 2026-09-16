# profile-handle

**Purpose.** Validate the handle a person chooses for themselves, and return the
form to store.

**Inputs.** The raw string they typed. **Outputs.** `{ ok: true, handle }` with
the normalised value, or `{ ok: false, problem }` with a code — `too-short`,
`too-long`, `charset`, `reserved`. A code and not a sentence: core holds no
user-facing copy, and the wording belongs next to the form that shows it.

**Gotchas.** Not `identity/normalize-handle`. That one folds a *platform* handle
out of a tournament export so two spellings of the same player meet — it
describes what somebody else wrote. This one constrains what we accept, and the
two must never be merged: loosening this would let a display name into a URL,
and tightening that would drop real players out of the ledger.

Lowercased **before** the uniqueness check. `Wren` and `wren` are one claim on
one URL, and a unique index over raw text would hold both.

The reserved list covers two different problems: handles that would shadow a
route, and handles that imply an authority nobody granted. `admin` is on it for
the second reason — `role` is admin-only precisely so that nobody can award it
to themselves, and a handle that merely looks official routes around that.

Policy: [`docs/modules/auth.md`](../../../../docs/modules/auth.md).
