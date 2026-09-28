# rating window

**Purpose.** The dates Elo replays (E25.6): parse an admin's start and end
dates, and say whether an event's date falls between them.

**Inputs.** The form's two date strings; or an `IsoDate` and a `RatingWindow`.

**Outputs.** A `RatingWindow` or an error message; a boolean.

**Gotchas.** Both ends are inclusive, and a blank end means no end. The
recompute filters in the ledger query, not with `inRatingWindow`; this is for
the processing page to say which events fall outside.

`pnpm --filter core test -- rating-window`
