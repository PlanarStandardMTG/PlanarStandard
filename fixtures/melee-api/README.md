# fixtures/melee-api

Two things from melee.gg:

- `tournament-list.json` — the `GET /api/tournament/list` response, which
  `core/events/parse-melee-events` reads (E23.12).
- `results-bundle.json` — one event's results as `adapters/melee-api` reads
  them (E12.10), with its expected `ParsedEvent` beside it.

## Provenance

`tournament-list.json` is a **real captured response** for the Planar Standard
Official organisation, committed verbatim. That is a stronger guarantee than
[`fixtures/challonge-api/`](../challonge-api/README.md) has, where the payload is
shaped from the documented schema rather than captured.

The credentials scope the response to the organisation: every member carries
`"OrganizationId": 18712`, and `RecordsTotal` is the organisation's own count.
Nothing in the parser filters by organisation, because nothing in the response
suggests another one can appear. If one ever does, that filter is the fix.

## What each member exercises

| Member   | What it exercises                                                    |
| -------- | -------------------------------------------------------------------- |
| `442716` | the ordinary finished event — `Ended`, dated, one phase              |
| `448894` | a second `Ended` event, to keep the past window sortable             |
| `450185` | `Canceled`, and named `test` — dropped                               |
| `450268` | two phases with a cut, so `structure` is `swiss + top 8 playoffs`    |
| `465247` | `Registration`, no `LastPairDateTime`, and a trailing space in `Name` |
| `467208` | `Canceled` with a `Planar Standard` format — still dropped           |

The trailing space on `Legality Fracture #1 ` is not a transcription slip. It is
in the live data, and it is why the parser trims.

## `results-bundle.json`

**Invented, not captured.** A results response names players, so this is the
document the site builds from the scrubbed fetches (`lib/melee/results.server.ts`),
filled with five made-up players. It covers a bye in every Swiss round, a 1-1-1
draw, a match melee left without a result, a player melee sent no username for,
a top-4 cut numbered after the Swiss, a list with a card on an unknown board, and
a registered player with no cards — a standing but not a decklist.
