# event-schedule

**Purpose.** Shape the cached calendar for display: group events into live /
upcoming / past, order each group the way the page reads, and pick the single
event to lead with.

**Inputs.** `ExternalEvent[]`, the current `Date`, and optionally how long a
finished event stays on the page (default 30 days). `nextEvent` takes the
`EventSchedule` the first call produced.
**Outputs.** An `EventSchedule` — always all three groups, empty rather than
absent — and, from `nextEvent`, one `ExternalEvent` or `null`.

**Gotchas.** A `scheduled` event whose start time has passed is shown as live.
Organisers routinely start a bracket without flipping its state on Challonge,
and an event from three weeks ago sitting at the top of "upcoming" was the
previous site's most visible bug. An event with no start date sorts **last**
within its group rather than being dropped — a bracket the organiser has not
dated yet is still worth advertising — and an undated finished event never ages
out, because there is no date to age it against. Ties break on name so the order
does not depend on what the cache happened to return.

`nextEvent` picks and never sorts: live first, then upcoming, each in the order
the schedule already put them in. A finished event is never "next", so a cache
holding nothing but last month's brackets returns `null` rather than the most
recent one. Neither function looks at `source` — an event on melee.gg and one on
Challonge compete for the same slot on the page.
