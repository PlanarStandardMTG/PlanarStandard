# sync-window

**Purpose.** Decide whether the event calendar is due a refresh, and give the
cutoff the claim compares against.

**Inputs.** The source's `lastAttemptedAt`, the current `Date`, and optionally an
interval.
**Outputs.** `isSyncDue` → boolean · `syncCutoff` → an ISO instant.

**Gotchas.** The input is the last **attempt**, never the last success: measuring
from success means an outage turns every page view into another request against
a 500-a-month budget. `EVENT_SYNC_INTERVAL_MS` is two hours — twelve requests a
day, 360 a month — and it is the only number to change if the budget or the
appetite for staleness changes. `now` is an argument because core is pure; a
module that called `Date.now()` could not be tested without a fake clock. An
unparseable timestamp reads as due, because refreshing early is recoverable and
never refreshing again is not.

Policy: [`docs/modules/events.md`](../../../../docs/modules/events.md).
