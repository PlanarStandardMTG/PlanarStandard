# run state

**Purpose.** Which state a run may move to, and what each move needs (E26.9).

**Inputs.** The run's state and structure, the target state, and its progress counted from its rows.

**Outputs.** `{ ok: true }`, or a refusal with a `reason` code and a sentence to show the organizer.

**Gotchas.** draft → registration → running → top cut → finished, cancelled from anywhere
before finished. No Swiss rounds goes registration → top cut; no cut (or a cut of one)
finishes after the last Swiss round. Starting needs two checked-in entrants; moving on
needs every result confirmed.

`pnpm --filter core test -- runs/run-state`
