# schedule entry

**Purpose.** A run as one more event on `/events`, beside the Challonge and melee.gg ones (E26.22).

**Inputs.** The run, how many have entered, and when it was read.

**Outputs.** An `ExternalEvent` with source `site`, linking to the run in `/play`; null for a draft or a cancelled run.

**Gotchas.** Registration is upcoming, Swiss and the cut are live, finished is complete. Not
cached like the platforms' events: the schedule reads runs fresh on every view.

`pnpm --filter core test -- runs/schedule-entry`
