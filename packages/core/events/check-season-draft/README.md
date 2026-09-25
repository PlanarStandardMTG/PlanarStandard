# check season draft

**Purpose.** Decide whether what an admin typed on `/admin/seasons` is a season that can be saved.

**Inputs.** The form's name, start, end and "current" flag, and every other
season's name and span.

**Outputs.** `{ ok: true, value: SeasonDraft }`, or the problems as codes for the page to word.

**Gotchas.** Seasons may not overlap, ends inclusive: an event's season is
found from its date, and two seasons holding one date would make that a guess. A
blank end is an open-ended season, which overlaps everything after it starts.

`pnpm --filter core test -- check-season-draft`
