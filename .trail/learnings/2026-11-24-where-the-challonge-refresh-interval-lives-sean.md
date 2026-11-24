---
title: Where the Challonge refresh interval lives
author: Sean
date: 2026-11-24
branch: main
cost: { minutes: 2, tokens: 37825 }
touches:
  - packages/core/events/sync-window/index.ts
  - docs/modules/events.md
  - packages/core/events/sync-window/README.md
  - apps/web/app/admin/fetching/page.tsx
---

## Decided

The event-calendar refresh interval is one constant, `EVENT_SYNC_INTERVAL_MS` in `packages/core/events/sync-window/index.ts` (2 hours). It is shared by Challonge and melee; there is no Challonge-only interval. `lib/events/sync-events.server.ts` and `/admin/fetching` both read it.

## Tried and ruled out

Searching for "challonge rate limit" finds nothing useful; the limit is expressed as this sync window, not as a rate limiter.

## Watch out

Changing the interval also means updating text that quotes "two hours" and "500 a month": the comment on the constant, `docs/modules/events.md` (table near line 51, note near line 64), `packages/core/events/sync-window/README.md`, and the copy at `apps/web/app/admin/fetching/page.tsx:325`.
