# event-schedule

**Purpose.** Group cached events into live / upcoming / past and order each group
the way the page reads.

**Inputs.** `ExternalEvent[]`, the current `Date`, and optionally how long a
finished event stays on the page (default 30 days).
**Outputs.** An `EventSchedule` — always all three groups, empty rather than
absent.

**Gotchas.** A `scheduled` event whose start time has passed is shown as live.
Organisers routinely start a bracket without flipping its state on Challonge,
and an event from three weeks ago sitting at the top of "upcoming" was the
previous site's most visible bug. An event with no start date sorts **last**
within its group rather than being dropped — a bracket the organiser has not
dated yet is still worth advertising — and an undated finished event never ages
out, because there is no date to age it against. Ties break on name so the order
does not depend on what the cache happened to return.
