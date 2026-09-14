# Planar Standard Hub — Backlog

Derived from `planar-standard-master-plan.md`. Every story below is intended to be finishable in one sitting by one person, and mergeable without waiting on anyone else once its dependencies are in.

**Conventions**

- **ID** — `E<epic>.<story>`. Stable; use it in branch names and PR titles.
- **Size** — `S` ≈ under an hour · `M` ≈ a sitting · `L` ≈ split it if you can.
- **Stream** — the parallel work stream from §18 of the plan.
- **Deps** — hard blockers only. Everything else can start now.
- Every story inherits the Definition of Done in §19. It is not repeated per story.

**Epic map**

| Epic | Title | Phase | Unblocked by |
|---|---|---|---|
| E1 | Workspace, CI, and dependency rules | 0 | — |
| E2 | Contracts | 0 | E1 |
| E3 | Decklist parsing | 7 | E2 |
| E4 | Card dataset pipeline | 3 | E1 |
| E5 | Legality engine | 3 | E2, E4 |
| E6 | Deck metrics | 7 | E2 |
| E7 | Similarity and layout | 8 | E2 |
| E8 | Elo engine | 6 | E2 |
| E9 | Identity signals and scoring | 4 | E2 |
| E10 | Stats primitives | 8 | E2 |
| E11 | Reddit transforms | 9 | — |
| E12 | Source adapters | 5 | E2 |
| E13 | Schema, migrations, repositories | 3–5 | E2 |
| E14 | RLS and access control | 1 | E13 |
| E15 | Seed data and local dev | 0 | E13 |
| E16 | Web foundation, auth, dashboard shell | 1 | E13 |
| E17 | MDX info pages | 2 | E16 |
| E18 | Services | 5–8 | E3–E13 |
| E19 | Chart components | 8 | E2 |
| E20 | Feature slices | 3–10 | E18 |
| E21 | Season II backfill | 7 | E3, E12, E18 |
| E22 | Governance and docs | 0 | — |

---

## E1 — Workspace, CI, and dependency rules

Phase 0. Nothing else is safe to start until the boundary rules are machine-enforced, because a broken boundary discovered in month three is a rewrite.

**E1.1 — pnpm workspace skeleton** · M · Stream —
Create `packages/{contracts,core,adapters,db}`, `apps/{web,jobs}`, `data/`, `content/pages/`, `fixtures/`, `docs/{adr,modules}`. Each package gets `package.json`, `tsconfig.json`, and an empty `index.ts`.
*AC:* `pnpm install` succeeds from a clean clone; `pnpm -r build` passes with empty packages.

**E1.2 — TypeScript project references and strict config** · S · —
Shared `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
*AC:* a type error in `contracts` fails the build of every dependent package.

**E1.3 — Vitest harness** · S · —
Root Vitest config, per-package test scripts, coverage reporter.
*AC:* `pnpm --filter core test` runs with zero environment variables set.

**E1.4 — dependency-cruiser rules** · M · —
Encode the §5 dependency graph: dependencies point left only, no cycles.
*AC:* a PR adding `import { x } from '@ps/db'` to `packages/core` fails CI with a readable message; `core` importing `next`, `react`, or `@supabase/*` also fails. **Deps:** E1.1

**E1.5 — Lint and format** · S · —
ESLint + Prettier (or Biome) wired into one `pnpm lint`.
*AC:* one command, one config, no per-package drift.

**E1.6 — CI pipeline** · M · —
GitHub Actions running `lint`, `test`, `depcruise`, `build` on every PR.
*AC:* status checks required on `main`; total runtime under five minutes on the empty repo. **Deps:** E1.3, E1.4

**E1.7 — Service-role key guard** · S · —
CI grep plus a dependency-cruiser rule preventing `SUPABASE_SERVICE_ROLE_KEY` from being reachable from any client bundle.
*AC:* a test fixture importing the key from a `'use client'` file fails CI. **Deps:** E1.4

**E1.8 — Module scaffold generator** · S · —
`pnpm new:module core/metrics/foo` emits `index.ts`, `index.test.ts`, `README.md` stubs.
*AC:* generated module passes lint and has a failing placeholder test.

**E1.9 — Fixtures directory conventions** · S · —
`fixtures/README.md` describing layout: one folder per source, real exports committed verbatim, expected outputs as sibling JSON.
*AC:* documented and referenced from `CONTRIBUTING.md`.

---

## E2 — Contracts

Phase 0. Eight small files. This is the unlock for eight parallel streams, so it should be one focused push, not a slow trickle.

Each story: define the types in `packages/contracts/<name>.ts`, export from the index, add a `README.md` line per exported type. All `S` unless noted. All **Deps:** E1.1.

**E2.1 — `cards`** — `OracleCard`, `CardPrinting`, `CardIndex`, `OracleId`, `Rarity`, `Layout`.
*AC:* `OracleCard` carries only fields the app uses; the shape is the contract the E4 build job must emit.

**E2.2 — `decks`** — `ParsedDeck`, `ParsedLine`, `ResolvedDeck`, `Board`.
*AC:* `ParsedLine` can represent a line with no set code and no collector number.

**E2.3 — `format`** — `FormatVersion`, `FormatRules`, `LegalityVerdict`, `Issue`.
*AC:* `LegalityVerdict` distinguishes illegal-card from illegal-deck-shape issues.

**E2.4 — `results`** — `RawInput`, `ParsedEvent`, `ParsedMatch`, `ParsedStanding`, `Capability`, `ResultsAdapter`. · M
*AC:* `ResultsAdapter` is `{ id, detect(RawInput): boolean, parse(RawInput): ParsedEvent, capabilities: Capability[] }`; a standings-only adapter type-checks without faking matches.

**E2.5 — `identity`** — `Handle`, `IdentityRef`, `MergeSuggestion`, `Signal`, `Exclusion`.
*AC:* `Signal` is a uniform `{ kind, confidence, evidence }` so new signals need no contract change.

**E2.6 — `ratings`** — `RatingConfig`, `RatingEvent`, `PlayerRating`, `LedgerMatch`.
*AC:* `LedgerMatch` references resolved player IDs, not handles — the replay boundary is visible in the type.

**E2.7 — `metrics`** — `DeckMetrics`, `CardStats`, `ArchetypeStats`, `SimilarityEdge`.
*AC:* `DeckMetrics` matches the `deck_metrics` table column for column.

**E2.8 — `content`** — `Post`, `PostStatus`, `InfoPageFrontmatter`.

**E2.9 — Contracts README and stability note** · S
*AC:* states that changing an exported type is a breaking change requiring a note in the PR description.

---

## E3 — Decklist parsing

Stream A. Pure, fixture-driven, no infrastructure. The best on-ramp in the repo alongside E12.

**E3.1 — Decklist fixture corpus** · M · Deps: E1.9
Commit real decklists covering: missing set codes, `*F*` markers, promo sets (`PSOS`), alphanumeric collectors (`25p`, `WOE-273`), split cards, fullwidth `｜` and `＞`, CRLF, BOM.
*AC:* one file per pathology, each named for what it exercises.

**E3.2 — `tokenize-line`** · M · Deps: E2.2
`"4 Bolt (FDN) 192 *F*"` → `{ qty, name, set, collector, foil }`.
*AC:* every fixture line tokenizes or returns a typed parse error with the offending column.

**E3.3 — `detect-board`** · S · Deps: E2.2
Recognize `SIDEBOARD:`, `Sideboard`, `SB:`, and blank-line boundaries.
*AC:* a blank line mid-maindeck followed by more cards does not falsely open a sideboard when a header form is present elsewhere in the file.

**E3.4 — `normalize-name`** · M · Deps: E2.2
NFKC, case-fold, punctuation, `//` handling, MDFC front/back faces.
*AC:* idempotent; `Sanar, Unfinished Genius / Wild Idea` normalizes identically to its `//` form.

**E3.5 — `parse-decklist`** · M · Deps: E3.2, E3.3, E3.4
Compose the above over a whole document → `ParsedDeck`.
*AC:* the full fixture corpus parses; unparseable lines are retained as issues rather than dropped.

**E3.6 — `parse-filename`** · M · Deps: E2.2
`Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL` → structured metadata.
*AC:* handles fullwidth `｜`, the OS-rewritten `_` variant, and a missing trailing segment; the trailing parenthetical alias is surfaced separately for E9.2.

**E3.7 — `core/decklist` README and module docs** · S · Deps: E3.5
*AC:* documents the grammar it accepts and the known-unsupported forms.

---

## E4 — Card dataset pipeline

Phase 3. ADR 002. Runs in `apps/jobs`, never in the web app.

**E4.1 — `data/sets.json` and its schema** · S
Seed with SOS, ECL, EOE, TDM, DFT, FDN plus a documented reason per entry.
*AC:* schema-validated in CI; adding a set is a reviewable one-line diff.

**E4.2 — Scryfall bulk index fetch** · S
Resolve the all-printings download URI from the bulk index endpoint.
*AC:* respects Scryfall terms — single bulk download, no request loop, attribution recorded in `meta.json`.

**E4.3 — Streaming prune** · L · Deps: E4.1, E4.2
Stream-parse the bulk file, keep printings whose set is in `sets.json` plus their oracle cards, keep only used fields.
*AC:* never calls `JSON.parse` on the whole file; peak memory bounded and asserted in the job log. *Split if needed: streaming reader, then the filter.*

**E4.4 — Emit `oracle.json`, `printings.json`, `meta.json`** · M · Deps: E4.3, E2.1
*AC:* output conforms to the `cards` contracts; `meta.json` records source bulk timestamp, set list, record counts, run date; output is byte-stable for unchanged input so diffs stay readable.

**E4.5 — GitHub Action: weekly and manual dispatch** · M · Deps: E4.4
*AC:* opens a PR only when the artifact changes; the PR body summarizes added/removed counts per set.

**E4.6 — Dataset size budget check** · S · Deps: E4.4
*AC:* CI fails if `data/cards/` exceeds an agreed ceiling, with the Release-asset fallback from Part VIII named in the failure message.

**E4.7 — Dataset loader for app and tests** · S · Deps: E4.4
A single helper that loads the artifact into memory once.
*AC:* importable from `jobs`, `web`, and tests; does not live in `core` (which takes the index as an argument).

---

## E5 — Legality engine

Stream A. ADR 007: legal if the oracle card has any printing in a legal set; any printing may then be played.

**E5.1 — `build-card-index`** · M · Deps: E2.1, E4.4
Dataset arrays → lookup maps by oracle id, normalized name, and set. Pure — takes the parsed dataset as an argument.
*AC:* no file I/O inside `core`; name map keyed by `normalize-name` output.

**E5.2 — `resolve-card-name`** · M · Deps: E5.1, E3.4
Parsed name → `oracle_id`, with fuzzy "did you mean" candidates on miss.
*AC:* exact match wins over fuzzy always; candidates ranked and capped; returns a miss rather than a wrong guess.

**E5.3 — `resolve-format`** · S · Deps: E2.3
Format version rows → flat `FormatRules`.
*AC:* legal sets, bans, restrictions, exceptions, and constraints collapse into one object the checkers can read without further queries.

**E5.4 — `check-card`** · M · Deps: E5.3
One card against pool, banlist, and exceptions.
*AC:* a card printed only in `M19` is legal when its oracle has an FDN printing; a `legal_exception` overrides pool absence; a ban overrides everything.

**E5.5 — `check-deck`** · M · Deps: E5.4
Sizes, copy limits, basic-land exemption; composes `check-card`.
*AC:* 60 min maindeck, 15 max sideboard, 4 copies max, basics exempt; returns all issues, not the first.

**E5.6 — Legality golden fixtures** · M · Deps: E5.5, E3.1
*AC:* a handful of real Season II decks assert legal; hand-built decks assert each distinct failure mode.

---

## E6 — Deck metrics

Stream B. Definitions are published verbatim at `/methodology`, so each story includes its definition text.

**E6.1 — `mana-curve`** · S · Deps: E2.7 — MV histogram, buckets 1–6 and 7+, non-lands only.
**E6.2 — `color-counts`** · S · Deps: E2.7 — counts per colour of identity.
**E6.3 — `type-counts`** · S · Deps: E2.7 — Land/Creature/Instant/…; multi-type cards counted per the documented rule.
**E6.4 — `set-attribution`** · M · Deps: E5.1 — attributes a card to its **legal** set, not its printed set. *AC:* `Llanowar Elves (M19)` counts as FDN; a card legal via two sets resolves deterministically by a documented tiebreak.
**E6.5 — `rarity-counts`** · S · Deps: E5.1 — C/U/R/MR, taken from the printing within the legal pool.
**E6.6 — `average-mv`** · S · Deps: E2.7 — incl. lands, excl. lands, sideboard.
**E6.7 — `compute-deck-metrics`** · M · Deps: E6.1–E6.6 — composes all of the above; counts `unresolved_cards`.
**E6.8 — `docs/modules/metrics.md`** · M · Deps: E6.7 — every definition in prose, the source for `/methodology`.

---

## E7 — Similarity and layout

Stream B. Basics excluded, non-basic lands included, maindeck only, default threshold 0.5.

**E7.1 — `deck-vector`** · S · Deps: E2.7 — `ResolvedDeck` → card→quantity map, basics excluded.
**E7.2 — `weighted-jaccard`** · S · Deps: E7.1 — `Σ min / Σ max`. *AC:* identical decks → 1; disjoint → 0; symmetric.
**E7.3 — `build-similarity-graph`** · M · Deps: E7.2 — all pairs above threshold → edge list. *AC:* at 98 nodes and threshold 0.5 reproduces roughly the 763 edges in the existing map.
**E7.4 — `force-layout`** · L · Deps: E7.3 — edge list → `{x, y}` per node with a **seeded RNG**. *AC:* same input and seed produces byte-identical output across runs and machines.
**E7.5 — Duplicate-deck flag** · S · Deps: E7.2 — similarity ≥ 0.85 surfaces a possible duplicate submission.

---

## E8 — Elo engine

Stream C. Entirely pure; `replay` takes matches already resolved to player IDs.

**E8.1 — `expected-score`** · S · Deps: E2.6 — `1 / (1 + 10^((Rb−Ra)/400))`.
**E8.2 — `pick-k`** · S · Deps: E2.6 — provisional / standard / elite, times tournament weight. *AC:* thresholds read from `RatingConfig`, never hard-coded.
**E8.3 — `apply-match`** · M · Deps: E8.1, E8.2 — both players updated simultaneously from pre-match ratings. *AC:* order of the two updates cannot change the result; draws and double-losses handled; byes excluded per config.
**E8.4 — `replay`** · M · Deps: E8.3 — ordered match stream → full rating history. *AC:* no I/O; fixture of matches produces an expected rating table; deterministic tiebreak for same-date matches.
**E8.5 — Anomaly detection during replay** · M · Deps: E8.4 — self-play, duplicate match IDs, impossible game counts, rating jumps beyond a bound. *AC:* returns anomalies as data for `rating_runs.anomalies`; does not throw.
**E8.6 — Activity and provisional flags** · S · Deps: E8.4 — derive `is_provisional`, `is_active`, `peak_rating`, per-player counters.

---

## E9 — Identity signals and scoring

Stream E. Per the plan, the single best contribution surface: one file, one function, one obvious test.

**E9.1 — `normalize-handle`** · S · Deps: E2.5 — lowercase, strip non-alphanumerics. *AC:* matches the Postgres generated-column expression exactly; a test asserts parity.
**E9.2 — `signals/parenthetical`** · S · Deps: E9.1 — `Zaunus13 (LikoRS)` → explicit pairing, confidence 0.95.
**E9.3 — `signals/deck-fingerprint`** · M · Deps: E7.1 — same 75 under two handles across events → 0.90.
**E9.4 — `signals/trigram`** · M · Deps: E9.1 — string similarity → 0.60.
**E9.5 — `signals/containment`** · S · Deps: E9.1 — `Liko` ⊂ `LikoRS` → 0.55.
**E9.6 — `signals/temporal`** · S · Deps: E2.5 — A's last event precedes B's first → 0.30.
**E9.7 — `co-appearance-exclusions`** · M · Deps: E2.5 — two handles in one event ⇒ never the same person. *AC:* emits ordered pairs satisfying the `identity_a < identity_b` check constraint.
**E9.8 — `score-candidates`** · M · Deps: E9.2–E9.7 — combine signals, apply exclusions, rank. *AC:* an exclusion zeroes a candidate regardless of signal strength; output carries per-signal evidence for `merge_suggestions.evidence`.
**E9.9 — Signal authoring guide** · S · Deps: E9.8 — `packages/core/identity/README.md` showing how to add a signal in one file. *AC:* linked from the `good first issue` template.

---

## E10 — Stats primitives

Stream B. Small, high-leverage, imported by every chart.

**E10.1 — `wilson`** · S · Deps: E2.7 — 95% CI on a proportion. *AC:* matches published reference values at n = 1, 10, 100.
**E10.2 — `aggregate-by`** · S — group-and-sum helpers used by every stats builder.
**E10.3 — `suppress-small-n`** · M · Deps: E10.1 — given a rate and n, decide show / grey / hide. *AC:* thresholds are named constants documented in `docs/modules/metrics.md`; card win rates suppressed under 20 games; archetype rows with n < 3 collapse to "insufficient data".

---

## E11 — Reddit transforms

Stream F. No dependencies at all. Each is a before/after fixture pair — the smallest real PR in the repo.

**E11.1 — `tables-to-lists`** · S
**E11.2 — `strip-html`** · S
**E11.3 — `absolutize-links`** · S — `](/cards/…` → `](https://…/cards/…`
**E11.4 — `images-to-links`** · S
**E11.5 — `expand-chart-shortcodes`** · M — `:::chart{…}` → link plus PNG reference.
**E11.6 — `to-reddit-markdown`** · M · Deps: E11.1–E11.5 — pipeline, appends canonical backlink. *AC:* idempotent on already-converted output.

---

## E12 — Source adapters

Stream D. One file per source, all pure, all fixture-tested. ADR 005, ADR 006.

**E12.1 — Adapter registry and `detect` dispatch** · M · Deps: E2.4 — try each adapter's `detect`, return the match or an actionable "unrecognized format" error. *AC:* ambiguous matches are reported, not silently resolved by registration order.
**E12.2 — `generic-csv`** · L · Deps: E12.1 — manual column mapping, matches or standings. *AC:* the permanent floor: any CSV with player/opponent/result columns imports after mapping; mapping persists to `result_imports.column_mapping`.
**E12.3 — `manual-entry`** · M · Deps: E12.1 — structured input → `ParsedEvent`, always available.
**E12.4 — `melee-csv`** · M · Deps: E12.1 — matches, standings, roster. Priority source. *AC:* real export committed to `fixtures/melee/`; expected `ParsedEvent` JSON asserted.
**E12.5 — `challonge-csv`** · M · Deps: E12.1 — matches, standings, roster.
**E12.6 — `legacy-xlsx`** · M · Deps: E12.1 — standings only, one-time backfill. *AC:* summary sheets ignored; only per-date sheets read.
**E12.7 — `archetype-map-html`** · L · Deps: E12.1 — decklists from hover text: player, date, both records, full list. One-time backfill.
**E12.8 — Capability gating test** · S · Deps: E12.1 — a standings-only `ParsedEvent` cannot produce matches. *AC:* asserts pairings are never inferred from placements.
**E12.9 — Adapter authoring guide** · S · Deps: E12.4 — `packages/adapters/README.md`: drop a fixture, write `detect` and `parse`, write expected output.

---

## E13 — Schema, migrations, repositories

Stream G. Migrations are numbered and forward-only, created in the order given in Part IV.

### Migrations

**E13.1 — `profiles` and role enum** · S · Deps: E1.1
**E13.2 — `format_versions`, `format_legal_sets`, `format_card_rules`, `format_constraints`** · M · Deps: E13.1 — *AC:* includes the no-card-tables note from §14.1 as a SQL comment; `oracle_id` columns carry no FK.
**E13.3 — `archetypes`, `archetype_aliases`** · S
**E13.4 — `seasons`** · S · Deps: E13.2 — *AC:* single-current partial unique index.
**E13.5 — `players`, `player_identities`** · M · Deps: E13.1 — *AC:* generated `normalized` column; `unique (platform, normalized)`.
**E13.6 — `tournaments`** · S · Deps: E13.4
**E13.7 — `decks`, `deck_cards`** · M · Deps: E13.3, E13.5, E13.6
**E13.8 — `result_imports`, `staged_matches`, `matches`, `match_corrections`** · L · Deps: E13.6 — *AC:* `unique (tournament_id, content_hash)`; ledger references `player_identities`, never `players`.
**E13.9 — `tournament_entries`** · S · Deps: E13.7, E13.8
**E13.10 — `identity_exclusions`, `merge_suggestions`, `player_merges`** · M · Deps: E13.8
**E13.11 — Ratings tables and `leaderboard` view** · M · Deps: E13.10 — `rating_config`, `rating_events`, `player_ratings`, `rating_runs`.
**E13.12 — Derived stats tables** · L · Deps: E13.9 — `deck_metrics`, `card_stats`, `archetype_stats`, `deck_similarity`, `deck_map_layout`, `matchup_stats`. *Split per table if the review gets long.*
**E13.13 — `posts`, `post_revisions`** · S · Deps: E13.1
**E13.14 — Index review pass** · S · Deps: E13.12 — every index in Part IV present; `explain` on the leaderboard and card-stats queries recorded in the PR.

### Repositories

One module per aggregate, narrow intention-revealing functions, never a generic query builder.

**E13.15 — `repos/format`** · M · Deps: E13.2
**E13.16 — `repos/decks`** · M · Deps: E13.7
**E13.17 — `repos/tournaments`** · M · Deps: E13.9
**E13.18 — `repos/results`** · L · Deps: E13.8
**E13.19 — `repos/identity`** · L · Deps: E13.10
**E13.20 — `repos/ratings`** · M · Deps: E13.11
**E13.21 — `repos/stats`** · L · Deps: E13.12
**E13.22 — `repos/content`** · M · Deps: E13.13
**E13.23 — `repos/archetypes`** · S · Deps: E13.3

*AC for each repo story:* exported functions are named for intent (`listRatedTournamentsBySeason`, not `query`); no SQL string escapes the module; a test hits a local Supabase instance.

---

## E14 — RLS and access control

**E14.1 — Public-read policies** · M · Deps: E13.12 — `format_*`, `archetypes`, derived stats, `leaderboard` view, public decks, published posts.
**E14.2 — Service-role write policies** · M · Deps: E13.12 — every derived table and the ledger.
**E14.3 — Organizer-gated writes** · M · Deps: E13.8 — tournaments and imports.
**E14.4 — Admin-only policies** · S · Deps: E13.10 — merges, format edits, role grants.
**E14.5 — `rls.test.ts`** · L · Deps: E14.1–E14.4 — full allow-deny matrix across anon / reader / writer / organizer / admin for every table. *Release blocker when red.*

---

## E15 — Seed data and local dev

The five-minute rule from §17. This is what makes every other contribution possible.

**E15.1 — Anonymization script for Season II** · L · Deps: E3.5 — real decklists and archetype distribution, synthetic handles and pairings.
**E15.2 — Seed loader** · M · Deps: E15.1, E13.12 — `pnpm db:reset` produces a populated site.
**E15.3 — Local Supabase scripts** · S · Deps: E13.1 — `db:start`, `db:reset`, `dev`.
**E15.4 — `CONTRIBUTING.md`** · M · Deps: E15.3 — the zero-credential path first, the full stack second, the two tasks that genuinely need secrets last.
**E15.5 — Freshness test for the seed** · S · Deps: E15.2 — *AC:* CI fails if a migration lands that the seed no longer satisfies.

---

## E16 — Web foundation, auth, dashboard shell

Phase 1. Stream J. Deploy on day one.

**E16.1 — Next.js app scaffold with Tailwind and shadcn** · M · Deps: E1.1
**E16.2 — Supabase client setup, server and browser** · M · Deps: E13.1 — *AC:* the service-role client is importable only from server contexts (guarded by E1.7).
**E16.3 — Discord OAuth login and callback** · M · Deps: E16.2
**E16.4 — `profiles` bootstrap on first login** · S · Deps: E16.3
**E16.5 — Role-aware route guards** · M · Deps: E16.4 — reader / writer / organizer / admin.
**E16.6 — Dashboard shell and navigation** · M · Deps: E16.5
**E16.7 — Deploy pipeline and preview environments** · M · Deps: E16.1 — *AC:* production deploy from `main`, preview per PR, environment variables documented.
**E16.8 — Error, empty, and loading states as shared components** · S · Deps: E16.1

---

## E17 — MDX info pages

Phase 2. Stream I. Several of these need no code at all.

**E17.1 — `@next/mdx` wiring with a whitelisted component set** · M · Deps: E16.1 — *AC:* MDX executes, so the allowed component list is explicit and tested.
**E17.2 — `<LegalSets />`** · S · Deps: E17.1, E13.15
**E17.3 — `<Banlist />`** · S · Deps: E17.1, E13.15
**E17.4 — `<Chart />` embed** · M · Deps: E17.1, E19
**E17.5 — `/(info)/[...slug]` route and nav generation** · M · Deps: E17.1
**E17.6 — Page: about** · S · **E17.7 — rules** · M · **E17.8 — getting-started** · S · **E17.9 — faq** · S · **E17.10 — organizers** · M (include the melee 60-day export warning) · **E17.11 — resources** · S
**E17.12 — Page: methodology** · M · Deps: E6.8 — *AC:* metric definitions verbatim from `docs/modules/metrics.md`; a test asserts the two do not drift.
**E17.13 — Page: ratings-explained** · M · Deps: E8.4

---

## E18 — Services

Thin coordinators only. If a service contains business logic, that logic belongs in `core`.

### import-results

**E18.1 — Upload, hash, archive raw bytes** · M · Deps: E13.18 — *AC:* content-hash idempotency; raw bytes archived permanently.
**E18.2 — Detect adapter and parse to staging** · M · Deps: E18.1, E12.1 — *AC:* `raw jsonb` retained per row so parser fixes re-run without the original file.
**E18.3 — Resolve handles to identities** · L · Deps: E18.2, E13.19 — auto-create on miss; record method and confidence per side.
**E18.4 — Review queue UI contract and commit** · L · Deps: E18.3 — staged → `matches`; sets `is_rated` from capabilities.
**E18.5 — Supersede on re-import** · M · Deps: E18.4 — *AC:* wholesale replacement, never a merge; prior import marked `superseded`.
**E18.6 — Corrections with audit and recompute** · M · Deps: E18.4 — *AC:* reason required; writes `match_corrections`; triggers recompute; Discord notice if a public rank moves.

### import-decklists

**E18.7 — Folder-drop path with filename metadata** · M · Deps: E3.6, E13.16
**E18.8 — Self-service paste path** · M · Deps: E3.5, E16.5
**E18.9 — Organizer entry path** · M · Deps: E13.17
**E18.10 — Unresolved-card handling** · S · Deps: E5.2 — *AC:* row kept, deck flagged, deck excluded from `card_stats` until fixed.
**E18.11 — Deck lock on event start** · S · Deps: E13.7 — ADR 013.

### recompute

**E18.12 — `recompute-ratings`** · L · Deps: E8.4, E13.20 — full replay resolving identities at read time; writes `rating_runs`. ADR 004.
**E18.13 — `recompute-metrics`** · L · Deps: E6.7, E13.21 — deck metrics, card stats, archetype stats.
**E18.14 — `recompute-similarity-and-layout`** · M · Deps: E7.4, E13.21
**E18.15 — `recompute-matchups`** · M · Deps: E13.9, E10.1 — requires `tournament_entries`; degrades to empty when the deck link is missing.

### other

**E18.16 — `merge-players`** · L · Deps: E13.19 — repoint identities, recompute, write `player_merges.moved`. *AC:* co-appearance exclusion blocks the merge at service level; reversible.
**E18.17 — Merge-suggestion generation job** · M · Deps: E9.8, E18.16
**E18.18 — `publish-post`** · M · Deps: E13.22 — status transition plus Discord notify.
**E18.19 — `notify-discord`** · S — webhook wrapper with a no-op mode when the secret is absent.

---

## E19 — Chart components

Stream H. Each takes already-shaped data as props and renders in Storybook from a fixture with no database.

**E19.1 — Storybook setup and fixture conventions** · M · Deps: E16.1
**E19.2 — Shared rate-display primitives** · M · Deps: E10.3 — a component that renders a rate with its `n` and Wilson interval, or suppresses it. Every rate on the site goes through this.
**E19.3 — `MetaShare`** · M — 100% stacked area; archetype / family / supertype toggle, default family.
**E19.4 — `ArchetypePerformance`** · M · Deps: E19.2 — sorted by deck count, Wilson bars, `n` per row, n<3 collapsed.
**E19.5 — `ManaCurve`** · S — per deck and per archetype against field average.
**E19.6 — `ColorDistribution`** · M — pie per event and share over time, `mana-font` symbols.
**E19.7 — `SetAdoption`** · M — stacked area.
**E19.8 — `CardScoreTable`** · L — TanStack Table; win-rate column suppressed under 20 games; label is "win rate of decks including this card".
**E19.9 — `CardInclusionSparkline`** · S
**E19.10 — `ArchetypeMap`** · L · Deps: E7.4 — Canvas, server-computed layout, size = games played, colour = family, `?highlight=` lights every deck running a card.
**E19.11 — `MatchupMatrix`** · M · Deps: E19.2 — heatmap, grouped by family by default.
**E19.12 — `RatingHistory`** · M
**E19.13 — `DeckVisualizer`** · M — image grid by type, curve, colours. Hotlinked Scryfall images with attribution.
**E19.14 — Chart-rules lint test** · S · Deps: E19.2 — *AC:* asserts every rate-displaying component imports the shared primitive.

---

## E20 — Feature slices

Slices own their routes, components, and hooks; they never import from each other.

**E20.1 — `auth` slice** · M · Deps: E16.3
**E20.2 — `content`: `/articles/*` and MDXEditor** · L · Deps: E18.18
**E20.3 — `content`: "Copy for Reddit" button** · S · Deps: E11.6, E20.2
**E20.4 — `cards`: `/cards` browse, filter, sort** · L · Deps: E4.7 — *AC:* filtering happens in-app against the loaded index, not in SQL.
**E20.5 — `cards`: `/cards/[oracleId]` detail** · M · Deps: E19.9, E20.4
**E20.6 — `decks`: `/decks/[id]`** · M · Deps: E19.13
**E20.7 — `decks`: submission flow** · M · Deps: E18.8
**E20.8 — `meta`: `/meta`** · M · Deps: E19.3, E19.4
**E20.9 — `meta`: `/meta/map`** · M · Deps: E19.10
**E20.10 — `meta`: `/meta/cards`** · M · Deps: E19.8
**E20.11 — `meta`: `/meta/matchups`** · M · Deps: E19.11
**E20.12 — `leaderboard`: `/leaderboard`** · M · Deps: E13.20
**E20.13 — `leaderboard`: `/players/[slug]`** · M · Deps: E19.12
**E20.14 — `tournaments`: `/tournaments/[slug]`** · M · Deps: E13.17
**E20.15 — `tournaments`: import dashboard** · L · Deps: E18.4
**E20.16 — `identity-admin`: merge grid** · L · Deps: E18.16
**E20.17 — `identity-admin`: CSV round-trip** · M · Deps: E20.16
**E20.18 — `format-admin`: `/dashboard/format`** · L · Deps: E13.15 — *AC:* validates `format_legal_sets` against `data/sets.json` and warns when a selected set is absent from the dataset; bans and exceptions editable without a deploy.
**E20.19 — Site search** · M · Deps: E20.4

---

## E21 — Season II backfill

A standalone script outside the main app, per the answer to open question 5. Run once, then delete or archive.

**E21.1 — Scrape 98 decklists from the archetype map HTML** · L · Deps: E12.7 — player, date, both records, full list from hover text.
**E21.2 — Cross-check records against per-date xlsx sheets** · M · Deps: E12.6 — *AC:* summary sheets ignored; mismatches reported, not silently reconciled.
**E21.3 — Auto-create identities and mine trailing parentheticals** · M · Deps: E9.2, E18.3
**E21.4 — Build exclusions from co-appearance across all nine events** · S · Deps: E9.7
**E21.5 — Run the suggestion engine and work the queue once** · M · Deps: E18.17, E20.16
**E21.6 — Confirm ratings stay empty** · S · Deps: E12.8 — *AC:* no rated tournament exists until an event with real pairings is imported.

---

## E22 — Governance, docs, and the four load-bearing tests

**E22.1 — Licence decision and file** · S — MIT or Apache-2.0, before the first external PR.
**E22.2 — Contributor Covenant CoC** · S
**E22.3 — `CODEOWNERS` per `area:` label** · S
**E22.4 — Issue labels and templates** · M — the nine `area:` labels plus `good first issue` templates for: new adapter, new identity signal, new Reddit transform, new decklist edge case, new chart, new MDX page.
**E22.5 — PR template encoding the Definition of Done** · S — the §19 checklist verbatim.
**E22.6 — ADRs 001–014** · L — one short file each. *Split into three PRs of four or five if review drags.*
**E22.7 — `docs/modules/` index** · S — one page per module, linked from each module README.

### Release-blocker tests

These four are called out in §22. Write them as early as their dependencies allow and treat breakage as a release blocker.

**E22.8 — `metrics-golden.test.ts`** · L · Deps: E6.7, E21.1 — import the `2026-08-01` decklists, assert computed `deck_metrics` match the existing spreadsheet column for column.
**E22.9 — `replay-identity.test.ts`** · L · Deps: E18.12, E18.16 — two handles with separate histories produce two ratings; bind them to one player, re-run, assert one merged rating **and that no row in `matches` changed**. Encodes ADR 003 and 004.
**E22.10 — `rls.test.ts`** · see E14.5.
**E22.11 — `dataset-integrity.test.ts`** · M · Deps: E4.4, E13.12 — every `oracle_id` in Postgres exists in `data/cards/`; every set in `format_legal_sets` is present in `data/sets.json`. This replaces the foreign keys the card tables would have provided.
**E22.12 — Playwright end-to-end happy path** · L · Deps: E15.2, E20.15 — import an event, commit it, see the leaderboard move.

---

## Ready to start today

With nothing merged yet, these need only E1 and E2:

E11.1–E11.6 (all six Reddit transforms) · E3.1 fixture corpus · E9.2, E9.5, E9.6 (three identity signals) · E10.1, E10.2 · E8.1, E8.2 · E17.6, E17.8, E17.9 (three MDX pages, no code) · E22.1, E22.2, E22.5

## Suggested first ten merges

1. E1.1 workspace skeleton
2. E1.4 dependency-cruiser rules
3. E1.6 CI pipeline
4. E2.1–E2.8 contracts (one PR or eight, but one week)
5. E22.5 PR template
6. E3.1 decklist fixture corpus
7. E4.1 `data/sets.json`
8. E4.3 + E4.4 dataset build
9. E13.1–E13.2 first migrations
10. E16.1 + E16.7 scaffold and deploy

After that the eight parallel streams from §18 are genuinely open, and the backlog stops being a queue.

## Counts

| Epic | Stories | Epic | Stories |
|---|---|---|---|
| E1 | 9 | E12 | 9 |
| E2 | 9 | E13 | 23 |
| E3 | 7 | E14 | 5 |
| E4 | 7 | E15 | 5 |
| E5 | 6 | E16 | 8 |
| E6 | 8 | E17 | 13 |
| E7 | 5 | E18 | 19 |
| E8 | 6 | E19 | 14 |
| E9 | 9 | E20 | 19 |
| E10 | 3 | E21 | 6 |
| E11 | 6 | E22 | 12 |

**208 stories across 22 epics.**
