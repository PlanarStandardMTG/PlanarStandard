# newly-completed

**Purpose.** Which fetched calendar events have just finished — the trigger for handling a
tournament's results exactly once (E23.13).

**Inputs.** The cache's `{ externalId, state }` for a source before the refresh, and the parsed
events the refresh fetched.

**Outputs.** The fetched events that are `complete` and were absent from the cache or in another
state.

**Gotchas.** Call it before `replaceEvents`: afterwards every complete event looks as if it always
was. An event the cache already has as complete is never returned, so a tournament stays in the
calendar for years and is still noticed once.

`pnpm --filter core test -- newly-completed`
