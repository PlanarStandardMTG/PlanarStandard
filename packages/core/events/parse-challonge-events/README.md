# parse-challonge-events

**Purpose.** The Challonge API v2.1 community-tournaments payload to canonical
`ParsedExternalEvent`s.

**Inputs.** The decoded JSON body, as `unknown`.
**Outputs.** `readonly ParsedExternalEvent[]` — no `id`, no `fetchedAt`; those
are the cache's to assign.

**Gotchas.** Deliberately tolerant: a member without an id or a name is skipped
and the batch survives, and a `state` nobody has seen before still produces an
event, grouped as scheduled. Showing an event in the wrong group is a smaller
failure than a third party's schema change emptying the page. Events whose name
contains `[TEST]` are dropped — that is the organisers' own marker for a bracket
they are wiring up. `url` is normally a slug and gets prefixed with
`https://challonge.com/`, but the API has been seen returning an absolute URL,
which is passed through.

Fixtures: [`fixtures/challonge-api/`](../../../../fixtures/challonge-api/README.md).
