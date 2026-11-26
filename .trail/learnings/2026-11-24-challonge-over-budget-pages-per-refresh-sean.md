---
title: "Challonge over budget: pages per refresh, not refresh rate"
author: Sean
date: 2026-11-24
branch: main
cost: { minutes: 28, tokens: 53269 }
touches:
  - apps/web/app/admin/fetching/page.tsx
  - apps/web/lib/challonge/client.server.test.ts
  - apps/web/lib/challonge/client.server.ts
  - apps/web/lib/events/sync-events.server.ts
  - backlog.md
  - docs/modules/events.md
  - packages/core/events/sync-window/README.md
  - packages/core/events/sync-window/index.test.ts
  - packages/core/events/sync-window/index.ts
  - packages/db/repos/events/index.test.ts
---

## Decided
The sync window limited refreshes, but each refresh was up to 4 requests (50 per page, no filter, so 87 events = 2 requests). Fixed in E23.18: one page of 100, `replaceEvents` with `prune: false` for Challonge, interval 3 hours (240 a month on the 500 plan). The v2.1 list endpoint returns events newest-created first (checked live).

## Tried and ruled out
Searching the web for v2.1 list parameters (sort, state filters) found nothing; v1 docs only. Not used. A request counter on the sync ledger was skipped to keep the change small.

## Watch out
Events are created in batches, so creation order is not start order. If Challonge outgrows 100 events, one finishing after it leaves the first page is never queued. Each finished event also costs 3+ requests, retried up to 5 times on failure.
