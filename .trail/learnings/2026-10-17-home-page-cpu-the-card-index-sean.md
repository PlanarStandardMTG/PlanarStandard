---
title: "Home page CPU: the card index on cold instances"
author: Sean
date: 2026-10-17
branch: main
cost: { minutes: 33, tokens: 181122 }
touches:
  - apps/web/app/decks/actions.ts
  - apps/web/app/page.tsx
  - apps/web/lib/events/sync-events.server.ts
  - apps/web/lib/podium/latest-podium.ts
  - backlog.md
  - apps/web/app/account/data/page.tsx
  - apps/web/app/account/password/page.tsx
  - apps/web/app/admin/events/page.tsx
  - apps/web/app/admin/fetching/page.tsx
  - "apps/web/app/admin/formats/[id]/page.tsx"
---

## Decided

- `/` used the most Vercel Active CPU (~180 ms a view against ~20 ms for /news or /events). The cause is the "last Monthly" podium: its colour pips call `cardIndex()`, which parses and indexes the 7 MB `data/cards/` dataset once per new server instance. `/` is where most visits start, so new instances pay for it there. Locally, a cold `/` was ~600 ms of CPU and a warm one ~30 ms.
- The podium is wrapped in `unstable_cache` (`cachedLatestPodium`, 1 h backstop). Vercel's data cache is shared across instances, so a cold instance no longer builds the index for `/`. `revalidatePath("/", "layout")` in the admin import actions expires it through Next's implicit route tags, and hiding deck versions calls `revalidatePath("/")`.
- The calendar refresh in `loadEvents` runs in `after()`, so a view never waits on the sync-window claim or on Challonge or melee.gg.

## Tried and ruled out

- Migrating to Cache Components / `"use cache"`: too broad for this fix. The app is `force-dynamic` throughout.

## Watch out

- Local seed data has no event with "Monthly" in its name, so the podium (and the card index) never runs on `/` locally. Rename a local event to measure it.
- Never pass the Supabase client into an `unstable_cache` function: its arguments become part of the cache key. Create the client inside.
- `/decks` (colours) and `/decks/[id]` still load the card index on a cold instance.
