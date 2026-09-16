# parse-melee-events

**Purpose.** The melee.gg `/api/tournament/list` payload to canonical
`ParsedExternalEvent`s (E23.12).

**Inputs.** The decoded JSON body, as `unknown`.
**Outputs.** `readonly ParsedExternalEvent[]` — no `id`, no `fetchedAt`; those
are the cache's to assign.

**Gotchas.**

- **The list payload carries no start time.** There is no scheduled-start field
  at all, only `LastPairDateTime`, which is null until the first round is paired.
  It is used as `startsAt` because for a finished event it lands within a round of
  when the event ran, which is what the 30-day past window and the sort need. An
  event still in registration comes back undated, and the card says so rather than
  inventing a date.
- **A cancelled tournament is dropped**, not mapped to `complete`. It is not on
  the calendar in any state. Two of the six in the capture are cancelled.
- Statuses are matched on `StatusDescription`, lowercased with everything but
  letters stripped, so `In Progress` and `inprogress` are the same status. The
  numeric `Status` is deliberately not used: 1, 3 and 4 have been observed and
  nothing documents the rest.
- `structure` is the phase names, ordered by `SortOrder` and joined — `swiss`, or
  `swiss + top 8 playoffs` for an event with a cut. It is the closest thing the
  payload has to a bracket shape.
- `participantCount` is always 0; the list payload does not carry one, and the
  card hides a count of zero.
- Tolerant in the same way `parse-challonge-events` is: a member with no `ID` or
  no `Name` is skipped and the batch survives, and an unrecognised status still
  produces an event, grouped as scheduled.

Fixtures: [`fixtures/melee-api/`](../../../../fixtures/melee-api/README.md).
