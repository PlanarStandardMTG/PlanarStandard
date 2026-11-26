---
title: Deck browser reads stored traits and legality
author: Sean
date: 2026-10-18
branch: main
cost: { minutes: 77, tokens: 561674 }
touches:
  - CLAUDE.md
  - "apps/web/app/admin/formats/[id]/page.tsx"
  - apps/web/app/admin/formats/actions.ts
  - apps/web/app/admin/formats/new/page.tsx
  - apps/web/app/admin/formats/page.tsx
  - apps/web/app/admin/processing/actions.ts
  - apps/web/app/admin/processing/page.tsx
  - apps/web/app/decks/(index)/browse-decks.tsx
  - "apps/web/app/decks/[id]/edit/page.tsx"
  - "apps/web/app/decks/[id]/page.tsx"
---

## Decided
- `/decks` no longer loads lists or the card data. `deck_traits` (pips, cast colours, normalized card names) and `deck_legality` (one row per deck and format version) are written by `lib/decks/deck-traits.server.ts` when a deck is saved: a member's save and `attachEventDecks` both call `refreshDecks`. With 806 local decks, a warm `/decks` went from 147 ms to 31 ms of CPU.
- `format_versions.deck_legality_stale` is set when an admin's save narrows a version's rules (`core/legality/rules-change`) or when cards are matched. "Recheck decks" on `/admin/processing` recomputes everything and clears it. A new or widened-only version is rechecked on save, because decks it newly allows would otherwise stay hidden. The user asked that growth not mark a version stale.
- Card names reach the page only when a card-name filter is active (`listBrowsableDecks({ withCardNames })`). They cost a few hundred bytes per deck.
- Lineage, filtering, the win-rate sort and paging stay in the page, over one slim row per public deck. Stored traits and legality removed the per-request work.
- The admin and deck actions now use the service role, so client components receive them as props from the server page, and state types live in the component, as `season-form.tsx` does. `guard:server-only` follows every import from a `'use client'` file, type-only ones included.

## Tried and ruled out
- Paging and the win-rate sort in SQL: deck lineage and small-n suppression are core logic, and moving them into SQL would duplicate them.

## Watch out
- PostgREST returns at most 1000 rows per request and doesn't say when it stops. Use `everyRow` in `repos/decks` for reads that can grow past that.
- After `pnpm db:reset`, or right after migration 0048 reaches production, no deck has traits, so `/decks` lists nothing until an admin presses "Recheck decks".
- Anything new that writes `deck_cards`, such as E26's entrant decks, must call `refreshDecks`.
- A tool that only reports whether a version is stale won't notice a change to the card data. Run "Recheck decks" after a card-data update.
- A test that needs a format version should name a seeded one by id. `repos/format`'s suite makes its own version current for a moment, then deletes it.
