# completion-status

**Purpose.** Where one finished tournament stands in the fetch queue, and the lease and attempt
limit that decide it (E23.13, E25.2).

**Inputs.** An `EventCompletion` and the time now.
**Outputs.** `fetched`, `running`, `waiting`, `retrying`, or `gave-up`.

**Gotchas.** `COMPLETION_LEASE_MS` and `COMPLETION_MAX_ATTEMPTS` live here so the runner that claims
and `/admin/fetching`, which reports, use the same numbers — a page that called a row "running" after the
runner had given up on its lease would be describing a different queue.

`pnpm --filter core test -- completion-status`
