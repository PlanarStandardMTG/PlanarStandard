# completion-status

**Purpose.** Where one finished tournament stands in the processing queue, and the lease and attempt
limit that decide it (E23.13).

**Inputs.** An `EventCompletion` and the time now.
**Outputs.** `processed`, `running`, `waiting`, `retrying`, `gave-up`, or `excluded` for an event on
neither the Elo nor the decklist line (E18.22), which nothing claims.

**Gotchas.** `COMPLETION_LEASE_MS` and `COMPLETION_MAX_ATTEMPTS` live here so the runner that claims
and the admin page that reports use the same numbers — a page that called a row "running" after the
runner had given up on its lease would be describing a different queue.

`pnpm --filter core test -- completion-status`
