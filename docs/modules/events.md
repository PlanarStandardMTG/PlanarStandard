# The event calendar

How `/events` and the home page's next-event tile work, why the refresh
interval is what it is, and what to change if it needs to be something else.
Epics E23 and E24.3.

The site does not run tournaments. Organisers run them somewhere else, and this
page is a cached window onto their calendars: what is on, what is coming, and a
link to each event's own page. There is no join and no leave. The previous site
had both, wired to a per-user Challonge OAuth connection, and dropping them is
deliberate — it removes an entire authentication flow from the site's surface in
exchange for a link.

## One schedule, however many calendars

`EventSource` is a union, and Challonge is the only member with a client behind
it today. Everything else is already source-agnostic and is meant to stay that
way:

| Source-agnostic                                    | Per-source                          |
| -------------------------------------------------- | ----------------------------------- |
| `listAllCachedEvents` — the read behind both pages | `listCachedEvents` — the refresh    |
| `eventSchedule`, `upcomingEvents`, `nextEvent`     | `claimSyncWindow`, `replaceEvents`  |
| `/events`, the home page's next-event tile         | one `external_event_syncs` row each |

The split is the budget. A **fetch** has to know whose calendar it is spending a
request on, and one platform being down must not spend another's window — so the
claim, the replace and the ledger row are all per-source. A **reader** asking
what is on this weekend does not care, so nothing downstream of the cache
branches on `source` except the label on the card.

`external_events.source` is `text`, not an enum, precisely so a second calendar
is a parser and a client rather than a migration. The ledger row is not: it is
the right to spend a request, so it arrives with the client that spends it, which
is why the seed has melee.gg events and no melee.gg sync row.

## The request budget is the design

Challonge allows **500 API requests a month**. That is roughly sixteen a day, and
it is the constraint every decision below falls out of.

| Interval    | Requests / day | Requests / 31 days |
| ----------- | -------------- | ------------------ |
| 5 minutes   | 288            | 8,928              |
| 30 minutes  | 48             | 1,488              |
| **2 hours** | **12**         | **372**            |
| 6 hours     | 4              | 124                |

Two hours is the shipped value. It leaves about a quarter of the month's budget
spare for a manual refresh, a future scheduled job, or a busy weekend — and the
page tells the reader how old what they are looking at is, so the staleness is
disclosed rather than hidden.

**To change it, change `EVENT_SYNC_INTERVAL_MS` in `core/events/sync-window` and
nothing else.** The repository, the service, and the page all read it from there.

## The refresh, in order

```
page render
  └─ claimSyncWindow           one conditional UPDATE; at most one caller wins
       ├─ nobody won → serve the cache and stop
       └─ we won
            ├─ fetchCommunityTournaments     lib/challonge/client.server.ts
            ├─ parseChallongeEvents          payload → ParsedExternalEvent[]
            ├─ replaceEvents                 upsert, then prune what is gone
            └─ recordSyncResult              success, or the error text
  └─ listAllCachedEvents + eventSchedule → the page
```

Three properties are worth stating because each one is a way this goes wrong:

**The interval is measured from the last _attempt_, not the last success.** If
Challonge is down and the interval were measured from the last success, every
page view would fire another request, and a single bad afternoon would spend the
month. Measuring from the attempt caps an outage at one request per window.

**The window is claimed before the fetch, in one statement.** `claimSyncWindow`
is a single conditional `UPDATE ... WHERE last_attempted_at < cutoff` that
returns the rows it touched. A read-then-write would let a burst of simultaneous
visitors each decide independently that a refresh was due.

**A failed refresh still serves the cache.** Nothing in the path rethrows. A
schedule two hours stale is worth far more to a visitor than an error page, and
the "refreshed N hours ago" line at the foot of the page is how they find out.

## Where the credentials live

`CHALLONGE_API_KEY` and `CHALLONGE_COMMUNITY` are production secrets held in
Vercel, and `apps/web/lib/challonge/client.server.ts` is the only module in the
repository that reads them. `.server.ts` is enforced: `pnpm guard:server-only`
(E1.7) fails CI if anything reachable from a `'use client'` module imports it.

**No contributor needs them.** With the variables unset the client returns
`not-configured`, no refresh is attempted, and the page renders whatever is in
the cache — which on a fresh clone is the eight seed events from
`packages/db/seed/0003_external_events.sql`, six on Challonge and two on
melee.gg. Every test in the epic runs with the
variables unset; the client's tests stub `fetch`.

## Why this is not the `tournaments` table

`external_events` is a cache of somebody else's calendar, rewritten wholesale on
every refresh. `tournaments` (§13) is the site's own record of an event that
happened, with a season, a format version, entries, and a ledger of matches that
ratings replay from.

Merging them would mean a third party's outage — or a bracket an organiser
deleted — could take rows out of the ledger. The refresh here is allowed to
delete anything it likes, which is only safe because nothing downstream depends
on it.

When an event advertised here later has its results imported, the link belongs on
`tournaments` as an external reference. It is not needed yet and has not been
invented ahead of time.

## Modules

| Module                                 | Job                                                       |
| -------------------------------------- | --------------------------------------------------------- |
| `core/events/parse-challonge-events`   | v2.1 payload → `ParsedExternalEvent[]`                    |
| `core/events/sync-window`              | is a refresh due, and the cutoff a claim compares against |
| `core/events/event-schedule`           | group and order the cache, and pick the one to lead with  |
| `db/repos/events`                      | the six reads and writes over the two tables              |
| `web/lib/events/source-label.ts`       | what to call each calendar where a reader can see it      |
| `web/lib/challonge/client.server.ts`   | the only module that talks to Challonge                   |
| `web/lib/events/sync-events.server.ts` | the order of operations, and nothing else                 |
