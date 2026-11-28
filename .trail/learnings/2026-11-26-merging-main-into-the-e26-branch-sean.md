---
title: Merging main into the E26 branch
author: Sean
date: 2026-11-26
branch: E26
cost: { minutes: 9, tokens: 81401 }
touches:
  - seo-handoff.md
---

## Decided

- E26 lives on its own branch, so main is merged in (never rebased: PR #1 is open and pushed). The Nov 26 merge was e1b2926.
- Migration numbers can collide. Main's 0048_deck_traits was live, so E26's migrations were renumbered to 0049–0055. This is safe only while no E26 migration has run outside local databases.
- E26 moved site pages into app/(site)/. Main's new imports of `@/app/decks/...` or `@/app/admin/...` must become `@/app/(site)/...`; depcruise reports them as no-unresolvable.
- The root layout stays children-only plus <Analytics />. The header and footer live in (site)/layout.tsx so /play keeps its own chrome.

## Tried and ruled out

- A fast-forward: the branches had diverged (36 commits ahead, 13 behind).

## Watch out

- Main's newer lint rules (next/link → @/components/ui/link, E16.18) and server-actions-as-props (E1.7) apply to E26 code after each merge.
- Right after `pnpm db:reset`, db tests may skip because the reachability probe fails. Rerun `pnpm --filter db test` before trusting the count (388 tests).
- trail check reports many keyword false positives on a merge. It flags main's own code as if this branch brought it back.
