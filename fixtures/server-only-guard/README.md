# fixtures/server-only-guard

Two tiny module trees that prove `scripts/check-server-only.ts` still works (E1.7).

- `clean/` — a `'use client'` component reaching only client-safe code, and a
  service-role client correctly parked in a `*.server.ts` module.
- `violating/` — the two failures the guard exists to catch: a `'use client'`
  module that transitively imports the server-only client, and a plain module
  that names `SUPABASE_SERVICE_ROLE_KEY` outside a server-only file.

The guard scans `apps/`, `packages/` and `scripts/` — never `fixtures/` — so the
violating tree is inert except when the self-test points the checker at it.
