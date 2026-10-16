---
title: Site copy is kept minimal
author: Sean
date: 2026-10-16
branch: main
cost: { minutes: 1489, tokens: 13316961 }
touches:
  - apps/web/app/account/data/page.tsx
  - apps/web/app/account/password/page.tsx
  - apps/web/app/admin/events/page.tsx
  - apps/web/app/admin/fetching/page.tsx
  - "apps/web/app/admin/formats/[id]/page.tsx"
  - apps/web/app/admin/formats/page.tsx
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/players/page.tsx
  - apps/web/app/admin/processing/page.tsx
  - apps/web/app/admin/seasons/page.tsx
---

## Decided
- User-facing copy says only what is needed: no intro paragraphs restating a page's title, no "X will be listed here" body under an empty state's title, short notices and errors ("Member banned.", "Type DELETE to confirm.").
- Kept on purpose: metadata descriptions (SEO), the privacy page (legal), /ratings-explained (generated from docs/modules/ratings.md via content:sync), Scryfall/WotC attribution, the decklist CSV format instructions, and "cannot be undone" warnings on destructive actions.
- `EmptyState`, `PageHeader` children and `PostFeedPage.emptyBody` are optional; use the title alone when the body would only restate it.

## Tried and ruled out
- Bulk regex extraction of prose lines across apps/web was too noisy (class strings, URLs); going page by page was faster.

## Watch out
- Removing a paragraph can leave a variable or a `Link` import unused; lint (`--max-warnings 0`) catches it.
- On main, `lib/decks/attach-event-decks.server.test.ts` fails if local data links a seeded member to a player; `pnpm db:reset` clears it (fixed properly on the E26 branch).
