# fixtures/challonge-api

The Challonge **API v2.1** community-tournaments list payload, which
`core/events/parse-challonge-events` reads (E23.2).

Not the same source as `fixtures/challonge/`, which holds a bracket **export**
for the `challonge-csv` results adapter (E12.5). One is a live calendar, the
other is a finished event's results; they share a vendor and nothing else.

## Provenance

`community-tournaments.json` is shaped from the v2.1 `GET
/communities/{community}/tournaments.json` response and from the request the
previous site made against it — same JSON:API envelope, same `attributes` keys,
same `state` vocabulary. The names, ids and dates are stand-ins, because the
endpoint needs a key that lives only in production.

That is a weaker guarantee than the rest of `fixtures/`, and the story that
added it says so. Replace this file with a captured response the first time
anyone holding the key runs the client, keeping the expected output honest.

## What each member exercises

| Member | What it exercises |
|---|---|
| `16042311` | the ordinary case — dated, `pending`, with a slug |
| `16042312` | `underway`, and a `url` that is already absolute |
| `16042313` | `awaiting_review` — over, but not `complete` |
| `16042314` | `complete`, and a `participants_count` of 0 |
| `16042315` | `group_stages_underway`, a state the previous site had no branch for |
| `16042316` | `[TEST]` in the name — dropped, as the previous site dropped it |
| `16042317` | no `starts_at`, no `url`, no `game_name` |
| `16042318` | a state nobody has seen before |
| (unnamed) | a member with no `name` at all — skipped, batch survives |

## `results-bundle.json`

**Invented, not captured.** A participants response names people, so this is the
document the site builds from the scrubbed fetches (`lib/challonge/results.server.ts`)
for `adapters/challonge-api` (E12.14), filled with five made-up players. The
field names were checked against the live v2.1 responses for the four Monthlies
of May–August 2026: a bracket match names its players only in
`points_by_participant`, a group match under `relationships` as well, and a
two-stage event says which stage a match is in only by where `round` and
`identifier` restart (`suggested_play_order` is mostly null in a group stage). The two-stage case is exercised in the adapter's
own test rather than here.

It covers a 2-1, a 1-1 tie, a bye, a winner reported with a 0-0 score, a score
that disagrees with its winner, a result read from the `scores` string alone, an
unplayed pairing, a bracket slot still waiting on a player, a match naming a
participant nobody listed, and a participant with no Challonge account.
