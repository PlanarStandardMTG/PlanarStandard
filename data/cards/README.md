# data/cards — GENERATED, do not hand-edit

Written by `pnpm --filter jobs build-card-data` (`apps/jobs/build-card-data/`). It
streams Scryfall's `default_cards` bulk file, keeps the printings whose set is in
`data/sets.json`, and prunes every field the app does not use.

Card data never enters Postgres (§14.1, ADR 002), so `oracle_id` columns carry no
foreign key — `dataset-integrity.test.ts` (E22.11) enforces that instead.

- `oracle.json` — one row per oracle card, `setCodes` unioned across the pool.
- `printings.json` — one row per printing in scope.
- `meta.json` — bulk timestamp, fetch scope, counts, run date, Scryfall attribution.

The two data files are byte-stable for unchanged input; `meta.json` moves every run
because it records `generatedAt`.
