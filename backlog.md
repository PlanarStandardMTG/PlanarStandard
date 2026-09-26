# Planar Standard Hub — Backlog

Derived from `planar-standard-master-plan.md`. Every story below is intended to be finishable in one sitting by one person, and mergeable without waiting on anyone else once its dependencies are in.

**Conventions**

- **ID** — `E<epic>.<story>`. Stable; use it in branch names and PR titles.
- **Size** — `S` ≈ under an hour · `M` ≈ a sitting · `L` ≈ split it if you can.
- **Stream** — the parallel work stream from §18 of the plan.
- **Deps** — hard blockers only. Everything else can start now.
- Every story inherits the Definition of Done in §19. It is not repeated per story.
- **Status** — ✅ done · 🚧 in progress · ⛔ blocked · ⬜ not started. A ⛔ carries a _Blocked:_ line
  naming what is needed. A ✅ carrying an _Outstanding:_ line shipped with one acceptance criterion
  deferred, and that criterion is named.

This file is the project's progress record. A story's marker flips in the same commit as its work —
see the "Keeping the backlog current" section of `CLAUDE.md`.

**Epic map**

| Epic | Title                                 | Phase | Unblocked by | Status   |
| ---- | ------------------------------------- | ----- | ------------ | -------- |
| E1   | Workspace, CI, and dependency rules   | 0     | —            | ✅ 9/9   |
| E2   | Contracts                             | 0     | E1           | ✅ 9/9   |
| E3   | Decklist parsing                      | 7     | E2           | ✅ 7/7   |
| E4   | Card dataset pipeline                 | 3     | E1           | 🚧 5/7   |
| E5   | Legality engine                       | 3     | E2, E4       | ✅ 6/6   |
| E6   | Deck metrics                          | 7     | E2           | ✅ 8/8   |
| E7   | Similarity and layout                 | 8     | E2           | ✅ 5/5   |
| E8   | Elo engine                            | 6     | E2           | ✅ 7/7   |
| E9   | Identity signals and scoring          | 4     | E2           | ✅ 9/9   |
| E10  | Stats primitives                      | 8     | E2           | ✅ 3/3   |
| E11  | Reddit transforms                     | 9     | —            | ✅ 6/6   |
| E12  | Source adapters                       | 5     | E2           | 🚧 9/14  |
| E13  | Schema, migrations, repositories      | 3–5   | E2           | ✅ 23/23 |
| E14  | RLS and access control                | 1     | E13          | ✅ 7/7   |
| E15  | Seed data and local dev               | 0     | E13          | 🚧 1/5   |
| E16  | Web foundation, auth, dashboard shell | 1     | E13          | 🚧 13/14 |
| E17  | MDX info pages                        | 2     | E16          | 🚧 12/13 |
| E18  | Services                              | 5–8   | E3–E13       | 🚧 5/21  |
| E19  | Chart components                      | 8     | E2           | ⬜ 0/14  |
| E20  | Feature slices                        | 3–10  | E18          | 🚧 21/36 |
| E21  | Season II backfill                    | 7     | E3, E12, E18 | ⬜ 0/6   |
| E22  | Governance and docs                   | 0     | —            | 🚧 3/12  |
| E23  | Upcoming events                       | 2     | E13.1        | 🚧 13/14 |
| E24  | Home page                             | 2     | E16.1        | 🚧 4/7   |

---

## E1 — Workspace, CI, and dependency rules

Phase 0. Nothing else is safe to start until the boundary rules are machine-enforced, because a broken boundary discovered in month three is a rewrite.

✅ **E1.1 — pnpm workspace skeleton** · M · Stream —
Create `packages/{contracts,core,adapters,db}`, `apps/{web,jobs}`, `data/`, `content/pages/`, `fixtures/`, `docs/{adr,modules}`. Each package gets `package.json`, `tsconfig.json`, and an empty `index.ts`.
_AC:_ `pnpm install` succeeds from a clean clone; `pnpm -r build` passes with empty packages.

✅ **E1.2 — TypeScript project references and strict config** · S · —
Shared `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
_AC:_ a type error in `contracts` fails the build of every dependent package.

✅ **E1.3 — Vitest harness** · S · —
Root Vitest config, per-package test scripts, coverage reporter.
_AC:_ `pnpm --filter core test` runs with zero environment variables set.
_Outstanding:_ coverage reporter not wired; vitest is per-package by choice, with no root config.

✅ **E1.4 — dependency-cruiser rules** · M · —
Encode the §5 dependency graph: dependencies point left only, no cycles.
_AC:_ a PR adding `import { x } from '@ps/db'` to `packages/core` fails CI with a readable message; `core` importing `next`, `react`, or `@supabase/*` also fails. **Deps:** E1.1

✅ **E1.5 — Lint and format** · S · —
ESLint + Prettier (or Biome) wired into one `pnpm lint`.
_AC:_ one command, one config, no per-package drift.

✅ **E1.6 — CI pipeline** · M · —
GitHub Actions running `lint`, `test`, `depcruise`, `build` on every PR.
_AC:_ status checks required on `main`; total runtime under five minutes on the empty repo. **Deps:** E1.3, E1.4
_Outstanding:_ branch protection on `main` is a repo setting and is still to be switched on.

✅ **E1.7 — Service-role key guard** · S · —
CI grep plus a dependency-cruiser rule preventing `SUPABASE_SERVICE_ROLE_KEY` from being reachable from any client bundle.
_AC:_ a test fixture importing the key from a `'use client'` file fails CI. **Deps:** E1.4

✅ **E1.8 — Module scaffold generator** · S · —
`pnpm new:module core/metrics/foo` emits `index.ts`, `index.test.ts`, `README.md` stubs.
_AC:_ generated module passes lint and has a failing placeholder test.

✅ **E1.9 — Fixtures directory conventions** · S · —
`fixtures/README.md` describing layout: one folder per source, real exports committed verbatim, expected outputs as sibling JSON.
_AC:_ documented and referenced from `CONTRIBUTING.md`.

---

## E2 — Contracts

Phase 0. Eight small files. This is the unlock for eight parallel streams, so it should be one focused push, not a slow trickle.

Each story: define the types in `packages/contracts/<name>.ts`, export from the index, add a `README.md` line per exported type. All `S` unless noted. All **Deps:** E1.1.

✅ **E2.1 — `cards`** — `OracleCard`, `CardPrinting`, `CardIndex`, `OracleId`, `Rarity`, `Layout`.
_AC:_ `OracleCard` carries only fields the app uses; the shape is the contract the E4 build job must emit.

✅ **E2.2 — `decks`** — `ParsedDeck`, `ParsedLine`, `ResolvedDeck`, `Board`.
_AC:_ `ParsedLine` can represent a line with no set code and no collector number.

✅ **E2.3 — `format`** — `FormatVersion`, `FormatRules`, `LegalityVerdict`, `Issue`.
_AC:_ `LegalityVerdict` distinguishes illegal-card from illegal-deck-shape issues.

✅ **E2.4 — `results`** — `RawInput`, `ParsedEvent`, `ParsedMatch`, `ParsedStanding`, `Capability`, `ResultsAdapter`. · M
_AC:_ `ResultsAdapter` is `{ id, detect(RawInput): boolean, parse(RawInput): ParsedEvent, capabilities: Capability[] }`; a standings-only adapter type-checks without faking matches.

✅ **E2.5 — `identity`** — `Handle`, `IdentityRef`, `MergeSuggestion`, `Signal`, `Exclusion`.
_AC:_ `Signal` is a uniform `{ kind, confidence, evidence }` so new signals need no contract change.

✅ **E2.6 — `ratings`** — `RatingConfig`, `RatingEvent`, `PlayerRating`, `LedgerMatch`.
_AC:_ `LedgerMatch` references resolved player IDs, not handles — the replay boundary is visible in the type.

✅ **E2.7 — `metrics`** — `DeckMetrics`, `CardStats`, `ArchetypeStats`, `SimilarityEdge`.
_AC:_ `DeckMetrics` matches the `deck_metrics` table column for column.

✅ **E2.8 — `content`** — `Post`, `PostStatus`, `InfoPageFrontmatter`.

✅ **E2.9 — Contracts README and stability note** · S
_AC:_ states that changing an exported type is a breaking change requiring a note in the PR description.

---

## E3 — Decklist parsing

Stream A. Pure, fixture-driven, no infrastructure. The best on-ramp in the repo alongside E12.

✅ **E3.1 — Decklist fixture corpus** · M · Deps: E1.9
Commit real decklists covering: missing set codes, `*F*` markers, promo sets (`PSOS`), alphanumeric collectors (`25p`, `WOE-273`), split cards, fullwidth `｜` and `＞`, CRLF, BOM.
_AC:_ one file per pathology, each named for what it exercises.

✅ **E3.2 — `tokenize-line`** · M · Deps: E2.2
`"4 Bolt (FDN) 192 *F*"` → `{ qty, name, set, collector, foil }`.
_AC:_ every fixture line tokenizes or returns a typed parse error with the offending column.

✅ **E3.3 — `detect-board`** · S · Deps: E2.2
Recognize `SIDEBOARD:`, `Sideboard`, `SB:`, and blank-line boundaries.
_AC:_ a blank line mid-maindeck followed by more cards does not falsely open a sideboard when a header form is present elsewhere in the file.

✅ **E3.4 — `normalize-name`** · M · Deps: E2.2
NFKC, case-fold, punctuation, `//` handling, MDFC front/back faces.
_AC:_ idempotent; `Sanar, Unfinished Genius / Wild Idea` normalizes identically to its `//` form.

✅ **E3.5 — `parse-decklist`** · M · Deps: E3.2, E3.3, E3.4
Compose the above over a whole document → `ParsedDeck`.
_AC:_ the full fixture corpus parses; unparseable lines are retained as issues rather than dropped.

✅ **E3.6 — `parse-filename`** · M · Deps: E2.2
`Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL` → structured metadata.
_AC:_ handles fullwidth `｜`, the OS-rewritten `_` variant, and a missing trailing segment; the trailing parenthetical alias is surfaced separately for E9.2.

✅ **E3.7 — `core/decklist` README and module docs** · S · Deps: E3.5
_AC:_ documents the grammar it accepts and the known-unsupported forms.

---

## E4 — Card dataset pipeline

Phase 3. ADR 002. Runs in `apps/jobs`, never in the web app.

✅ **E4.1 — `data/sets.json` and its schema** · S
Seed with SOS, ECL, EOE, TDM, DFT, FDN plus a documented reason per entry.
_AC:_ schema-validated in CI; adding a set is a reviewable one-line diff.
_Note:_ shipped as a bare array of codes, without the per-entry reason the line called for —
the reason a set is in the pool is obvious from the format's rotation rule, and an object per
entry would have cost the one-line diff the AC asks for. `sets-scope` validates shape,
set-code form, duplicates and emptiness, and reports every problem at once.

✅ **E4.2 — Scryfall bulk index fetch** · S
Resolve the all-printings download URI from the bulk index endpoint.
_AC:_ respects Scryfall terms — single bulk download, no request loop, attribution recorded in `meta.json`.
_Note:_ there is no `all-printings` bulk type; the one that means "every printing, English" is
**`default_cards`**. The field is `jsonl_download_uri` and the payload is gzipped JSONL, not a
JSON array — `download_uri` no longer exists. `selectBulkSource` throws rather than falling back,
so the next such change fails the build instead of quietly shipping a wrong dataset.

✅ **E4.3 — Streaming prune** · L · Deps: E4.1, E4.2
Stream-parse the bulk file, keep printings whose set is in `sets.json` plus their oracle cards, keep only used fields.
_AC:_ never calls `JSON.parse` on the whole file; peak memory bounded and asserted in the job log.
_Note:_ JSONL made the streaming reader a `readline` loop rather than a streaming JSON parser, so
the split the line offered was not needed. Real run: 118,026 rows read, 2,916 kept, 5.1s, peak
rss 325 MB — flat in input size, since only surviving rows are held.
_Note:_ `reversible_card` rows carry no top-level `oracle_id`, `cmc` or `type_line` and cannot form
a printing. All 11 in the pool are alternate printings of cards reachable elsewhere, so they are
dropped; `unreachableOracleIds` fails the build if that ever stops being true.

✅ **E4.4 — Emit `oracle.json`, `printings.json`, `meta.json`** · M · Deps: E4.3, E2.1
_AC:_ output conforms to the `cards` contracts; `meta.json` records source bulk timestamp, set list, record counts, run date; output is byte-stable for unchanged input so diffs stay readable.
_Note:_ required adding `"prepare"` to the `Layout` union in `@ps/contracts` — a Secrets of
Strixhaven split-like layout on 36 cards in the pool, absent from the seeded union. **Breaking
type change.** `meta.json` is the one file that is not byte-stable, because it records
`generatedAt`; E4.5 must gate its PR on the two data files or it opens an empty PR weekly.
_Outstanding:_ the dataset is committed from a local run. E4.5 moves that to CI.

⬜ **E4.5 — GitHub Action: weekly and manual dispatch** · M · Deps: E4.4
_AC:_ opens a PR only when the artifact changes; the PR body summarizes added/removed counts per set.

⬜ **E4.6 — Dataset size budget check** · S · Deps: E4.4
_AC:_ CI fails if `data/cards/` exceeds an agreed ceiling, with the Release-asset fallback from Part VIII named in the failure message.

✅ **E4.7 — Dataset loader for app and tests** · S · Deps: E4.4
A single helper that loads the artifact into memory once.
_AC:_ importable from `jobs`, `web`, and tests; does not live in `core` (which takes the index as an argument).
_Note:_ it needed **a sixth package**, `packages/cards`. `core` does no file I/O and `web` may not
import `jobs`, so there was nowhere existing for a loader to live that both apps could reach. The
§5 diagram, `CLAUDE.md` and `.dependency-cruiser.cjs` all gained the node; it sits beside `db`, one
step left of the apps, and the rule that dependencies point left is unchanged.
_Note:_ `loadCardDataset` and `loadCardIndex` memoize **per directory**, so a test passes its own
path and gets its own copy — which is why no cache-clearing function exists for production code to
reach for.
_Note:_ a new depcruise rule, `only-cards-reads-a-file`, forbids `node:fs` anywhere in
`contracts`, `core`, `adapters` or `db` outside a test. Self-tested: adding an `fs` import to
`build-card-index` fails the cruise.
_Note:_ `apps/web` reads these files at runtime and Next's tracing does not follow a path built
from `import.meta.url`, so `outputFileTracingIncludes` in `next.config.ts` names `data/cards/`. It
arrived with the first pages that load the index, the deck import and format admin, not E20.4.

---

## E5 — Legality engine

Stream A. ADR 007: legal if the oracle card has any printing in a legal set; any printing may then be played.

✅ **E5.1 — `build-card-index`** · M · Deps: E2.1, E4.4
Dataset arrays → lookup maps by oracle id, normalized name, and set. Pure — takes the parsed dataset as an argument.
_AC:_ no file I/O inside `core`; name map keyed by `normalize-name` output.

✅ **E5.2 — `resolve-card-name`** · M · Deps: E5.1, E3.4
Parsed name → `oracle_id`, with fuzzy "did you mean" candidates on miss.
_AC:_ exact match wins over fuzzy always; candidates ranked and capped; returns a miss rather than a wrong guess.

✅ **E5.3 — `resolve-format`** · S · Deps: E2.3
Format version rows → flat `FormatRules`.
_AC:_ legal sets, bans, restrictions, exceptions, and constraints collapse into one object the checkers can read without further queries.

✅ **E5.4 — `check-card`** · M · Deps: E5.3
One card against pool, banlist, and exceptions.
_AC:_ a card printed only in `M19` is legal when its oracle has an FDN printing; a `legal_exception` overrides pool absence; a ban overrides everything.

✅ **E5.5 — `check-deck`** · M · Deps: E5.4
Sizes, copy limits, basic-land exemption; composes `check-card`.
_AC:_ 60 min maindeck, 15 max sideboard, 4 copies max, basics exempt; returns all issues, not the first.

✅ **E5.6 — Legality golden fixtures** · M · Deps: E5.5, E3.1
_AC:_ a handful of real Season II decks assert legal; hand-built decks assert each distinct failure mode.

---

## E6 — Deck metrics

Stream B. Definitions are published verbatim at `/methodology`, so each story includes its definition text.

✅ **E6.1 — `mana-curve`** · S · Deps: E2.7 — MV histogram, buckets 1–6 and 7+, non-lands only.
✅ **E6.2 — `color-counts`** · S · Deps: E2.7 — counts per colour of identity.
✅ **E6.3 — `type-counts`** · S · Deps: E2.7 — Land/Creature/Instant/…; multi-type cards counted per the documented rule.
✅ **E6.4 — `set-attribution`** · M · Deps: E5.1 — attributes a card to its **legal** set, not its printed set. _AC:_ `Llanowar Elves (M19)` counts as FDN; a card legal via two sets resolves deterministically by a documented tiebreak.
✅ **E6.5 — `rarity-counts`** · S · Deps: E5.1 — C/U/R/MR, taken from the printing within the legal pool.
✅ **E6.6 — `average-mv`** · S · Deps: E2.7 — incl. lands, excl. lands, sideboard.
✅ **E6.7 — `compute-deck-metrics`** · M · Deps: E6.1–E6.6 — composes all of the above; counts `unresolved_cards`.
✅ **E6.8 — `docs/modules/metrics.md`** · M · Deps: E6.7 — every definition in prose, the source for `/methodology`.

---

## E7 — Similarity and layout

Stream B. Basics excluded, non-basic lands included, maindeck only, default threshold 0.5.

✅ **E7.1 — `deck-vector`** · S · Deps: E2.7 — `ResolvedDeck` → card→quantity map, basics excluded.
✅ **E7.2 — `weighted-jaccard`** · S · Deps: E7.1 — `Σ min / Σ max`. _AC:_ identical decks → 1; disjoint → 0; symmetric.
✅ **E7.3 — `build-similarity-graph`** · M · Deps: E7.2 — all pairs above threshold → edge list. _AC:_ at 98 nodes and threshold 0.5 reproduces roughly the 763 edges in the existing map.
_Outstanding:_ the 763-edge calibration against the real 98-deck corpus is still outstanding — needs E21.1.
✅ **E7.4 — `force-layout`** · L · Deps: E7.3 — edge list → `{x, y}` per node with a **seeded RNG**. _AC:_ same input and seed produces byte-identical output across runs and machines.
✅ **E7.5 — Duplicate-deck flag** · S · Deps: E7.2 — similarity ≥ 0.85 surfaces a possible duplicate submission.

---

## E8 — Elo engine

Stream C. Entirely pure; `replay` takes matches already resolved to player IDs.

✅ **E8.1 — `expected-score`** · S · Deps: E2.6 — `1 / (1 + 10^((Rb−Ra)/400))`.
✅ **E8.2 — `pick-k`** · S · Deps: E2.6 — provisional / standard / elite, times tournament weight. _AC:_ thresholds read from `RatingConfig`, never hard-coded.
✅ **E8.3 — `apply-match`** · M · Deps: E8.1, E8.2 — both players updated simultaneously from pre-match ratings. _AC:_ order of the two updates cannot change the result; draws and double-losses handled; byes excluded per config.
✅ **E8.4 — `replay`** · M · Deps: E8.3 — ordered match stream → full rating history. _AC:_ no I/O; fixture of matches produces an expected rating table; deterministic tiebreak for same-date matches.
✅ **E8.5 — Anomaly detection during replay** · M · Deps: E8.4 — self-play, duplicate match IDs, impossible game counts, rating jumps beyond a bound. _AC:_ returns anomalies as data for `rating_runs.anomalies`; does not throw.
✅ **E8.6 — Activity and provisional flags** · S · Deps: E8.4 — derive `is_provisional`, `is_active`, `peak_rating`, per-player counters.
✅ **E8.7 — `rated-by-default`** · S · Deps: E2.6 — a tournament's name → whether it feeds Elo on
import. Only Monthlies are rated: `Monthly Championship Series - September 2026` is, `Mid-Month
Madness #2` and a weekly are not. _AC:_ matches the whole word `Monthly`, case-insensitive; the result
only seeds `tournaments.is_rated`, which an admin can flip afterwards (E20.34), so a misnamed event
never needs a PR.

---

## E9 — Identity signals and scoring

Stream E. Per the plan, the single best contribution surface: one file, one function, one obvious test.

✅ **E9.1 — `normalize-handle`** · S · Deps: E2.5 — lowercase, strip non-alphanumerics. _AC:_ matches the Postgres generated-column expression exactly; a test asserts parity.
✅ **E9.2 — `signals/parenthetical`** · S · Deps: E9.1 — `Zaunus13 (LikoRS)` → explicit pairing, confidence 0.95.
✅ **E9.3 — `signals/deck-fingerprint`** · M · Deps: E7.1 — same 75 under two handles across events → 0.90.
✅ **E9.4 — `signals/trigram`** · M · Deps: E9.1 — string similarity → 0.60.
✅ **E9.5 — `signals/containment`** · S · Deps: E9.1 — `Liko` ⊂ `LikoRS` → 0.55.
✅ **E9.6 — `signals/temporal`** · S · Deps: E2.5 — A's last event precedes B's first → 0.30.
✅ **E9.7 — `co-appearance-exclusions`** · M · Deps: E2.5 — two handles in one event ⇒ never the same person. _AC:_ emits ordered pairs satisfying the `identity_a < identity_b` check constraint.
✅ **E9.8 — `score-candidates`** · M · Deps: E9.2–E9.7 — combine signals, apply exclusions, rank. _AC:_ an exclusion zeroes a candidate regardless of signal strength; output carries per-signal evidence for `merge_suggestions.evidence`.
✅ **E9.9 — Signal authoring guide** · S · Deps: E9.8 — `packages/core/identity/README.md` showing how to add a signal in one file. _AC:_ linked from the `good first issue` template.

---

## E10 — Stats primitives

Stream B. Small, high-leverage, imported by every chart.

✅ **E10.1 — `wilson`** · S · Deps: E2.7 — 95% CI on a proportion. _AC:_ matches published reference values at n = 1, 10, 100.
✅ **E10.2 — `aggregate-by`** · S — group-and-sum helpers used by every stats builder.
✅ **E10.3 — `suppress-small-n`** · M · Deps: E10.1 — given a rate and n, decide show / grey / hide. _AC:_ thresholds are named constants documented in `docs/modules/metrics.md`; card win rates suppressed under 20 games; archetype rows with n < 3 collapse to "insufficient data".

---

## E11 — Reddit transforms

Stream F. No dependencies at all. Each is a before/after fixture pair — the smallest real PR in the repo.

✅ **E11.1 — `tables-to-lists`** · S
✅ **E11.2 — `strip-html`** · S
✅ **E11.3 — `absolutize-links`** · S — `](/cards/…` → `](https://…/cards/…`
✅ **E11.4 — `images-to-links`** · S
✅ **E11.5 — `expand-chart-shortcodes`** · M — `:::chart{…}` → link plus PNG reference.
✅ **E11.6 — `to-reddit-markdown`** · M · Deps: E11.1–E11.5 — pipeline, appends canonical backlink. _AC:_ idempotent on already-converted output.

---

## E12 — Source adapters

Stream D. One file per source, all pure, all fixture-tested. ADR 005, ADR 006.

✅ **E12.1 — Adapter registry and `detect` dispatch** · M · Deps: E2.4 — try each adapter's `detect`, return the match or an actionable "unrecognized format" error. _AC:_ ambiguous matches are reported, not silently resolved by registration order.
_Note:_ `generic-csv` reads any delimited file, so on `detect` alone it is ambiguous with every CSV source in §9. It is marked `fallback` in the registry and consulted only once no specific adapter has claimed the input — a declared role, not a position in the list, and the ambiguity test asserts the outcome is unchanged with the registry reversed.
✅ **E12.2 — `generic-csv`** · L · Deps: E12.1 — manual column mapping, matches or standings. _AC:_ the permanent floor: any CSV with player/opponent/result columns imports after mapping; mapping persists to `result_imports.column_mapping`.
_Outstanding:_ the adapter reads `RawInput.columnMapping` and the fixture tests round-trip one, and `createImport` stores one in `result_imports.column_mapping`, but nothing passes one until the upload path (E18.1–E18.2) exists.
✅ **E12.3 — `manual-entry`** · M · Deps: E12.1 — structured input → `ParsedEvent`, always available.
⛔ **E12.4 — `melee-csv`** · M · Deps: E12.1 — matches, standings, roster. Priority source. _AC:_ real export committed to `fixtures/melee/`; expected `ParsedEvent` JSON asserted.
_Blocked:_ needs a real melee.gg export committed to `fixtures/melee/`.
⛔ **E12.5 — `challonge-csv`** · M · Deps: E12.1 — matches, standings, roster.
_Blocked:_ needs a real Challonge export committed to `fixtures/challonge/`.
⛔ **E12.6 — `legacy-xlsx`** · M · Deps: E12.1 — standings only, one-time backfill. _AC:_ summary sheets ignored; only per-date sheets read.
_Blocked:_ needs the legacy per-date `.xlsx` committed to `fixtures/legacy/`.
✅ **E12.7 — `archetype-map-html`** · L · Deps: E12.1 — decklists from hover text: player, date, both records, full list. One-time backfill.
_Note:_ the hover text sorts all 75 cards alphabetically with no sideboard header, so `decklistText` is one merged board. Which fifteen were the sideboard is not in the file, and E21.1 inherits that.
✅ **E12.8 — Capability gating test** · S · Deps: E12.1 — a standings-only `ParsedEvent` cannot produce matches. _AC:_ asserts pairings are never inferred from placements.
✅ **E12.9 — Adapter authoring guide** · S · Deps: E12.4 — `packages/adapters/README.md`: drop a fixture, write `detect` and `parse`, write expected output.
_Note:_ written without E12.4. The dependency existed so the guide would have a worked example; `archetype-map-html` and `generic-csv` are that example, and the four rules it has to teach — omit an empty payload, never infer pairings, a bye has no opponent, do not guess — are all demonstrable without a melee export.

✅ **E12.10 — `melee-api`** · L · Deps: E12.1 — the same event's results straight from melee.gg's
API rather than from an export: match history, standings, roster, and a decklist per player. A
different adapter from E12.4, not a replacement for it — `melee-csv` reads a file an organiser
downloaded and needs no credentials, and it stays the path for anyone who cannot call the API.
_AC:_ a captured API response committed to `fixtures/melee-api/` and the expected `ParsedEvent`
asserted against it; the adapter stays pure, so fetching belongs to the caller and `RawInput.bytes`
is the response body. That directory already holds E23.12's `tournament-list.json`, so name the
capture for its endpoint and leave the calendar's alone — one vendor API, one directory, one file per
endpoint.
_Note:_ `RawInput.bytes` is not a response body. It is one JSON document the site assembles from
the three scrubbed fetches — `{ adapter: "melee-api", tournament, matches, decklists }` — because a
raw response names people and never leaves `lib/melee/` (E12.11). The fixture,
`fixtures/melee-api/results-bundle.json`, is that document with invented players, which is what
unblocked the story. Standings ride on decklists, so an event nobody submitted a list for yields
matches and a roster only. Rounds use melee's `SortOrder`, which counts across phases.
✅ **E12.11 — `melee-api`: the results endpoints, fetched and scrubbed** · M · Deps: E23.12 —
_AC:_ the tournament, match-list, decklist-list and decklist endpoints are reachable from the site
through functions that return only melee ids, results and decklists — never a name, handle, Discord,
email or pronoun — and nothing outside `lib/melee/` can reach an unscrubbed response.
_Note:_ added outside the plan, as E12.10's groundwork. The endpoints come from melee's Swagger
document (`swagger/docs/v0.3.64.190`). `lib/melee/transport.server.ts` sends every request;
`results.server.ts` keeps the raw results fetches private and exports scrubbed `get…` functions that
copy an allowlist; `.dependency-cruiser.cjs`' `melee-transport-is-private` fails CI on any import of
the transport from outside `lib/melee/`. The decklist list carries each player's final rank and
record, so it is the roster and the standings as well as the lists.
✅ **E12.12 — `melee-api`: keep the player's username** · S · Deps: E12.11 — the one personal field
the scrub lets through, because identity needs a handle to resolve (E18.20) and an admin needs one to
merge (E20.16). _AC:_ each competitor carries melee's public username; legal names, Discord, Arena,
email and pronouns are still dropped, and a test asserts each of them is absent.
_Note:_ `Username` — the account's handle — rather than `DisplayName`, which can be the
player's real name. Competitors now carry `players: { id, username }[]` in
place of `playerIds`, and a decklist carries `username` from `OwnerUsername`.
⬜ **E12.13 — Challonge results endpoints, fetched and scrubbed** · M · Deps: E23.7 — a finished
tournament's participants and matches, through `lib/challonge/` as E12.11 did for melee. _AC:_ each
participant keeps its Challonge id and username only; two requests per event, counted against the
500-a-month budget the calendar already spends from.
⬜ **E12.14 — `challonge-api` adapter** · M · Deps: E12.13 — the E12.13 payload → `ParsedEvent`, matches
and standings, no decklists (Challonge has none). _AC:_ a fixture with invented participants in the
captured shape and its expected `ParsedEvent`; `onTournamentCompleted` ingests a Challonge event the
way it does a melee.gg one, and the release notes say to press "Re-run everything" once, since
Challonge events finished before this were marked processed with nothing done.

---

## E13 — Schema, migrations, repositories

Stream G. Migrations are numbered and forward-only, created in the order given in Part IV.

### Migrations

✅ **E13.1 — `profiles` and role enum** · S · Deps: E1.1
✅ **E13.2 — `format_versions`, `format_legal_sets`, `format_card_rules`, `format_constraints`** · M · Deps: E13.1 — _AC:_ includes the no-card-tables note from §14.1 as a SQL comment; `oracle_id` columns carry no FK.
_Note:_ the seed carries no `format_card_rules` rows. The live banlist is announced in Discord and is not in this repository, and an empty banlist is a state `/rules` has to render correctly anyway.
✅ **E13.3 — `archetypes`, `archetype_aliases`** · S
✅ **E13.4 — `seasons`** · S · Deps: E13.2 — _AC:_ single-current partial unique index.
✅ **E13.5 — `players`, `player_identities`** · M · Deps: E13.1 — _AC:_ generated `normalized` column; `unique (platform, normalized)`.
_Note:_ closes E9.1's outstanding parity check. `fixtures/identity/normalized-handles.json` is read by both `core/identity/normalize-handle`'s test and `packages/db/generated-columns.test.ts`, so the two implementations are asserted against one table instead of against a list typed out twice — neither package has to import the other.
_Note:_ no seed rows. Synthetic handles and pairings are E15.1's job, and inventing a second set here would be the thing that seed has to reconcile with.
✅ **E13.6 — `tournaments`** · S · Deps: E13.4
✅ **E13.7 — `decks`, `deck_cards`** · M · Deps: E13.3, E13.5, E13.6
_Note:_ `visibility <> 'private'` is the read policy, so an **unlisted deck is readable**. Unlisted
means "not in the listings", and a policy that hid it would break the share link that is the whole
point of the state — filtering a browse page down to `public` is the query's job. E14.1 revisits it
and E14.5 is where the full allow-deny matrix lands; `repos/decks`' tests assert this table's half of
it in the meantime — private hidden from the anon client but present to service-role, unlisted served
by id, neither listed by a browse query.
_Note:_ no seed rows, following E13.5. A deck needs a player and a tournament to mean anything, and
inventing a second synthetic set here is exactly what E15.1 would then have to reconcile with.
✅ **E13.8 — `result_imports`, `staged_matches`, `matches`, `match_corrections`** · L · Deps: E13.6 — _AC:_ `unique (tournament_id, content_hash)`; ledger references `player_identities`, never `players`.
_Note:_ two check constraints the §13 DDL does not list, because both are ways the ledger gets quietly
corrupted rather than loudly broken. `matches_bye_has_no_opponent` — a bye recorded against an
opponent means a parser invented a pairing (ADR 006). `matches_no_self_pairing` — both sides on one
identity is a merge `co-appearance-exclusions` should have blocked (E9.7), and rating it hands
somebody free points against themselves. Both verified rejecting at the database.
_Note:_ `match_result` had never actually been created — §13 lists it beside `tournament_status`, and
E13.6 created only the latter. It lands here, with the table that needs it.
_Note:_ no policy at all on `result_imports` and `staged_matches`: they hold uploaded file paths, raw
source rows and per-side resolution confidences, which is an operator's workspace rather than
published record. `matches` and `match_corrections` are public, scoped to the tournament's own
visibility — "computed from data you can read" is not true if the ledger cannot be read, and a
correction log only admins can see leaves a moved rating unexplainable to the person it moved.
Verified: a draft tournament's matches are invisible to anon and present to service-role.
✅ **E13.9 — `tournament_entries`** · S · Deps: E13.7, E13.8
_Note:_ this references `players` where `matches` references `player_identities`, and the difference
is the point. A match is raw history, so a merge repoints identities and rewrites nothing (ADR 003).
An entry is a resolved standing, and a person cannot finish fourth and ninth at one event. That makes
`unique (tournament_id, player_id)` the **co-appearance rule (E9.7) enforced by the database** — a
merge that would collide here is a merge that must be refused. E18.16 checks it first and gives a
readable error; this catches it if the service ever forgets. Verified rejecting at the database,
along with `placement > 0`.
✅ **E13.10 — `identity_exclusions`, `merge_suggestions`, `player_merges`** · M · Deps: E13.8
_Note:_ `check (identity_a < identity_b)` now exists, which `core/identity/co-appearance-exclusions`
has been citing in a comment since E9.7 — it emits ordered pairs _because of_ this constraint, and
the constraint was not there. The orders agree: core sorts the canonical lowercase hyphenated text
and Postgres compares the 16 bytes, which for that spelling is the same order.
_Note:_ `merge_suggestions` gets the same ordered-pair check, which §12 does not specify. Without it
`unique (player_a, player_b)` does not mean what it reads as — (A,B) and (B,A) would be two rows and
an admin would review the same pair twice. `player_merges` gets `winner_id <> loser_id` for a similar
reason: a self-merge is a no-op that leaves an audit row claiming a merge happened.
_Note:_ **no read policy on any of the three**, which is where this differs from `match_corrections`.
A correction is about an event's data, and is public so a rating that moved can be explained to the
person it moved. These are assertions about _people_ — that two handles are one person, or that
somebody suspected they were — and `players.visibility = 'hidden'` exists because not everyone wants
to be listed at all. Publishing a merge would route around that. Admin access is E14.4.
✅ **E13.11 — Ratings tables and `leaderboard` view** · M · Deps: E13.10 — `rating_config`,
`rating_events`, `player_ratings`, `rating_runs`.
_Note:_ the view is `with (security_invoker = true)`. Without it a view runs as its owner and reads
straight past the policies on the tables under it — a hidden player would reappear on the leaderboard
even though every underlying table hides them. The view's own `where` clause excludes them too; this
is the half that keeps working if somebody edits that clause.
_Note:_ everything here except `rating_config` is derived and recomputable (ADR 004). A replay
truncates `rating_events` and `player_ratings` and rebuilds them from `matches`; if a number here
disagrees with the ledger, the ledger is right and this is stale.
_Note:_ no policy on `rating_runs` — its `anomalies` name players in the context of something having
gone wrong with their data, which is operator surface. The other three are public: a rating nobody
can check is a rating nobody trusts, and `/ratings-explained` publishes the thresholds, so
`rating_config` has to be readable or the page describes something invisible.
_Note:_ verified that raising `min_matches_for_leaderboard` drops a player off the leaderboard with
no deploy — the same "authority is data, not code" property the format tables have.
✅ **E13.12 — Derived stats tables** · L · Deps: E13.9 — `deck_metrics`, `card_stats`,
`archetype_stats`, `deck_similarity`, `deck_map_layout`, `matchup_stats`.
_Note:_ the RLS splits three and three. `card_stats`, `archetype_stats` and `matchup_stats` are
aggregates and are public outright — they are the numbers the footer promises you can read. The other
three name individual decks and follow that deck's visibility instead: a private deck's mana curve,
or its dot on the map, discloses that the deck exists and roughly what is in it. `deck_similarity`
needs **both** ends public, not either, since an edge joins two decks. Verified: an edge touching a
private deck is invisible to anon and present to postgres.
_Note:_ `card_stats.board` allows two values where `deck_cards.board` allows three. The command zone
is not part of the inclusion statistics the site publishes, and a `command` row would quietly widen
every "played in N% of decks" number. Verified rejecting.
_Note:_ every rate is stored next to its `n` — `win_rate` beside `game_wins`/`game_losses`,
`inclusion_rate` beside `decks_including`. A rate stored without the count it came from cannot be
passed through `suppress-small-n` or explained to a reader, which is a merge-blocking requirement
rather than a preference.
✅ **E13.13 — `posts`, `post_revisions`** · S · Deps: E13.1
✅ **E13.14 — Index review pass** · S · Deps: E13.12 — every index in Part IV present; `explain` on the leaderboard and card-stats queries recorded in the PR.
_Note:_ the plans are in [`docs/modules/indexes.md`](docs/modules/indexes.md) rather than only in the
PR, along with what each of the 32 indexes serves and the volume they were measured at. A PR
description is not somewhere the next person looks.
_Note:_ two sequential scans were measured and left alone — `matchup_stats` filtered from either side
of its ordered pair, and `posts` by author. Both tables are small by construction, and the page says
at what size to revisit each.
_Note:_ `indexes.test.ts` holds the doc's table and the migrations to the same set, so a new index
that nobody documents fails rather than drifting.

### Repositories

One module per aggregate, narrow intention-revealing functions, never a generic query builder.

✅ **E13.15 — `repos/format`** · M · Deps: E13.2
_Note:_ returns rows (`FormatVersionDetail`, added to contracts), not `FormatRules` — flattening is `core/legality/resolve-format`'s job and `db` depends on contracts only. A restricted rule is given `limit: 1` here because `format_card_rules` has no column for it.
✅ **E13.16 — `repos/decks`** · M · Deps: E13.7 — `getDeckWithCards`, `listDecksByPlayer`,
`listPublicDecksBySeason`, `insertDeck`.
_Note:_ the read policy decides what **may** be read and a listing decides what **is** listed, so
`listPublicDecksBySeason` filters `visibility = 'public'` itself rather than leaning on RLS, and
`listDecksByPlayer` deliberately does not. Getting that backwards either leaks every unlisted deck or
breaks every share link.
_Note:_ `insertDeck` is not atomic — PostgREST has no transaction across two tables, so it writes the
deck, writes the cards, and deletes the deck if the cards fail. A `decks` row with no `deck_cards`
reads as an empty deck everywhere. Genuine atomicity means a `plpgsql` function and an RPC.
_Note:_ needed `Deck`, `DeckCard` and `DeckWithCards` in contracts, and those could not be written
until the fourteen row-id aliases moved to `contracts/primitives` — a `Deck` references five ids
owned by five modules, three of which already import from `decks`, so the type was three cycles.
✅ **E13.17 — `repos/tournaments`** · M · Deps: E13.9 — `getTournamentBySlug`,
`listTournamentsBySeason`, `listRatedTournamentsBySeason`, `getLatestTournamentWithResults`,
`listTournamentEntries`.
_Note:_ `listRatedTournamentsBySeason` returns **oldest first, and the order is the contract**. Elo is
path-dependent, so a descending sort would not fail anything — it would quietly produce a different
leaderboard (ADR 004, E8.4). Ties break on slug so two events on one date replay reproducibly.
_Note:_ `getLatestTournamentWithResults` is the read E24.5 needs, written now and correctly returning
the seeded `planar-standard-weekly-40`. It excludes `archived` deliberately: somebody took that event
down, and resurfacing it on the home page would undo that.
_Note:_ writing this suite exposed a cross-file hazard in two earlier ones. Vitest runs test files in
parallel, so a suite that clears a whole table clears it out from under whoever else is using it —
this one's `vitest-%` cleanup was deleting `generated-columns.test.ts`'s fixture player mid-run. Both
this suite and `repos/decks` now delete by the ids they created.
✅ **E13.18 — `repos/results`** · L · Deps: E13.8 — the import pipeline (`createImport`,
`findImportByContentHash`, `updateImportStatus`, `supersedeOtherImports`), staging
(`replaceStagedMatches`, `listStagedMatches`, `resolveStagedMatch`), the ledger
(`replaceTournamentMatches`, `listMatchesByTournament`, `listLedgerMatchesBySeason`) and the
correction log (`recordMatchCorrection`, `listMatchCorrections`).
_Note:_ **`listLedgerMatchesBySeason` is where ADR 003 happens.** The ledger stores identities and
`LedgerMatch` names players; that translation is done at read time, here, which is exactly why a
merge changes every rating and rewrites no history. It orders date → round → match id, and that order
is a contract: Elo is path-dependent, so a different one is a different leaderboard, silently.
_Note:_ which client a function takes is not a style choice. `result_imports` and `staged_matches`
have RLS on with **no policy**, so the anon client reads them as empty with no error — passing the
public client is a bug that looks like an event with no rows. Asserted.
_Note:_ both identity embeds carry an explicit FK hint. `matches` has two foreign keys into
`player_identities` and PostgREST will not guess between them.
✅ **E13.19 — `repos/identity`** · L · Deps: E13.10 — `getPlayerBySlug`, `getPlayer`,
`findIdentityByNormalizedHandle`, `listIdentitiesByPlayer`, `createPlayerWithIdentity`,
`addIdentity`, `listExclusions`, `recordExclusions`, `listPendingMergeSuggestions`,
`replaceMergeSuggestions`, `reviewMergeSuggestion`, `repointPlayerRows`, `markPlayerMerged`,
`recordPlayerMerge`, `listPlayerMerges`.
_Note:_ the lookup takes the **normalized** handle, not the raw one. `normalized` is a generated
column and `packages/db` may not import `core/identity/normalize-handle` to produce it — the
dependency rule points the other way — so the caller normalizes and the two are held to
`fixtures/identity/normalized-handles.json` by `generated-columns.test.ts`.
_Note:_ `repointPlayerRows` moves identities, entries and decks and returns what it moved, which is
what `recordPlayerMerge` persists and what makes E18.16's undo possible. It does not touch `matches`
(ADR 003) or the rating tables (ADR 004, recompute rather than move).
_Note:_ adds `Player`, `MergeMoves`, `PlayerMerge` and `NewPlayerMerge` to `@ps/contracts` — the
`players` and `player_merges` rows had no contract type before this.
✅ **E13.20 — `repos/ratings`** · M · Deps: E13.11 — `getRatingConfig`, `getLeaderboard`,
`getPlayerRating`, `listRatingHistory`, `replaceRatings`, `recordRatingRun`, `listRatingRuns`.
_Note:_ there is **one** write, and that is the design. `replaceRatings` takes a whole replay and
replaces everything; no function here moves one player's rating, because ADR 004 says full recompute
and an API offering both would make the leaderboard depend on call order.
_Note:_ `getLeaderboard` reads the **view**, not `player_ratings`. Who qualifies is answered in one
place, and a caller filtering the table by hand is a second answer that eventually disagrees.
_Note:_ every `numeric` goes through `Number`. PostgREST returns them as JSON numbers until a value
is wide enough to need a string, and a rating arriving as `"1712.5"` sorts as text and renders as
text without ever throwing.
_Note:_ this suite and `repos/results` both write matches, and test files run in parallel while
`replaceTournamentMatches` clears a whole tournament by design — so they claim different seeded
events. Sharing one is a foreign-key violation in whichever suite loses the race.
✅ **E13.21 — `repos/stats`** · L · Deps: E13.12 — `getDeckMetrics`, `listDeckMetrics`,
`upsertDeckMetrics`, `listCardStats`, `getCardStats`, `replaceCardStats`, `listArchetypeStats`,
`replaceArchetypeStats`, `listMatchupStats`, `listMatchupsForArchetype`, `replaceMatchupStats`,
`listSimilarityEdges`, `replaceSimilarityEdges`, `listLayoutPoints`, `replaceLayout`.
_Note:_ every write replaces a **season** wholesale rather than updating a row, for the reason
`replaceRatings` does (ADR 004). Seasons are replaced independently, because they are — recomputing
Season II must not clear Season I. `upsertDeckMetrics` is the exception and is keyed by deck, since a
deck's metrics depend only on that deck.
_Note:_ nothing here suppresses anything. A stored rate comes back with the `n` it came from and the
caller renders the pair through `core/stats/suppress-small-n` (ADR 012, E10.3) — suppressing at this
layer would hand the UI a missing rate with no way to say why.
✅ **E13.22 — `repos/content`** · M · Deps: E13.13
✅ **E13.23 — `repos/archetypes`** · S · Deps: E13.3 — `listArchetypes`, `getArchetype`,
`findArchetypeByAlias`.
_Note:_ the lookup tries aliases first, then the archetype's own **name** — a name is obviously a
spelling of itself and the vocabulary does not register it as an alias. The alias path ignores
punctuation, spacing and case; the name path only case, because `archetypes.name` has no normalized
column. A null result is a normal answer: the deck keeps its `archetype_raw` until somebody adds the
alias, and re-resolving then fixes every deck that ever carried it.
_Note:_ `normalizeAlias` duplicates the `archetype_aliases.normalized` generated column, because `db`
depends on contracts only and cannot import `core`. Drift would not fail — it would silently stop
matching — so the suite asserts the two against every seeded alias, the arrangement
`normalize-handle` already has with `generated-columns.test.ts`.

_AC for each repo story:_ exported functions are named for intent (`listRatedTournamentsBySeason`, not `query`); no SQL string escapes the module; a test hits a local Supabase instance.

---

## E14 — RLS and access control

✅ **E14.1 — Public-read policies** · M · Deps: E13.12 — `format_*`, `archetypes`, derived stats, `leaderboard` view, public decks, published posts.
_Note:_ nothing to write. Every table shipped its own read policy with the migration that created it, which
turned out to be the better arrangement — the policy and the reason for it are in the same file. This
story closed by being asserted rather than implemented: `rls.test.ts` now names all 23 public tables.
✅ **E14.2 — Service-role write policies** · M · Deps: E13.12 — every derived table and the ledger.
_Note:_ also nothing to write, and for a sharper reason — **service-role bypasses RLS entirely**, so a
policy granting it writes would be decoration. What actually protects a derived table is that _no_
write policy exists for anon or authenticated, so ADR 008's "a derived statistic is never uploaded"
holds by absence. An absence is invisible, so E14.5 asserts it: nine derived tables refuse an insert
from an admin, the highest role there is.
✅ **E14.3 — Organizer-gated writes** · M · Deps: E13.8 — tournaments and imports.
_Note:_ `tournaments`, `result_imports`, `staged_matches`, `players`, `player_identities` for all; the
ledger (`matches`, `tournament_entries`, `match_corrections`) **insert-only**. No delete for anybody:
re-importing supersedes wholesale as service-role, and an organizer who could delete a match by hand
could quietly move a rating (ADR 004, ADR 006).
✅ **E14.4 — Admin-only policies** · S · Deps: E13.10 — merges, format edits, role grants.
_Note:_ role grants work by permissive policies being ORed — an admin has both `profiles_self_update`
and `profiles_admin_update`, so an admin may change a role while everybody else still may not change
their own. `has_role` is `security definer` so that a policy on `profiles` reading `profiles` does not
recurse, and `stable` so the planner calls it once a statement rather than once a row.
✅ **E14.5 — `rls.test.ts`** · L · Deps: E14.1–E14.4 — full allow-deny matrix across anon / reader / writer / organizer / admin for every table. _Release blocker when red._
_Note:_ 115 assertions over real sessions, one per role. Writes are probed with an empty insert and
judged only on whether **42501** came back — a not-null or foreign-key complaint means the policy let
it through, which is the thing being measured, and it avoids building a valid row for two dozen tables
whose columns are not under test. Two traps found while writing it, both now commented: asking for the
row back with `.select()` adds a `RETURNING`, and with one Postgres evaluates the policy _before_ the
not-null constraint — which made the probe report refusals that never happened. And a read that returns
nothing is indistinguishable from an empty table, so denials are only asserted where rows exist to be
hidden.
_Outstanding:_ `post_revisions` and `decks` still take no writes from anybody. Their write paths are
E20.2 and E20.7, and a policy written now would be a guess at a flow that does not exist — the matrix
asserts the current refusal so that adding one is a deliberate change. `posts` got its policies at
E14.6, and `decks` a member's own-deck policies at E20.28 (`repos/decks` tests them); an organizer's
write path is still E20.7.
✅ **E14.6 — Post submission and review policies** · M · Deps: E14.5 — _AC:_ any member may submit;
only writer and up may publish directly; a writer or above approves or returns what is in `review`;
nobody publishes under another member's name.
_Note:_ approval is a `security definer` function, `review_post`, not an update policy. A rejected
post becomes a draft only its author can read, and PostgREST reads an updated row back, so a policy
refused the rejection after making it; a policy would also have let a reviewer edit any column of
somebody else's post. A trigger keeps `author_id` fixed and stamps `published_at`. `official` posts
are admin-only, since that kind is the format's own voice. The rule is also `core/content/post-workflow`,
for the pages.
✅ **E14.7 — Bans, and no admin acting on themselves** · S · Deps: E14.4 — _AC:_ a banned member
clears no rung and cannot edit their profile; an admin cannot change their own role or ban themselves.
_Note:_ `profiles.banned_at`, with `has_role` returning false for a banned caller at every rung, so
every existing policy shut without an edit. The account and its data are kept, and export and
erasure still work. Enforced in RLS only: a banned member can still sign in and read what anybody
can, and Supabase's own auth-level ban is not used.

---

## E15 — Seed data and local dev

The five-minute rule from §17. This is what makes every other contribution possible.

⬜ **E15.1 — Anonymization script for Season II** · L · Deps: E3.5 — real decklists and archetype distribution, synthetic handles and pairings.
⬜ **E15.2 — Seed loader** · M · Deps: E15.1, E13.12 — `pnpm db:reset` produces a populated site.
✅ **E15.3 — Local Supabase scripts** · S · Deps: E13.1 — `db:start`, `db:reset`, `dev`.
_Note:_ plus `dev:db`, which chains all three with `env:web` (writes `apps/web/.env.local` from the
example when there is none) — one command from a fresh clone, or a stopped stack, to a seeded site on
:3000. It resets every run, so local data does not survive a restart; `pnpm dev` alone keeps it.
⬜ **E15.4 — `CONTRIBUTING.md`** · M · Deps: E15.3 — the zero-credential path first, the full stack second, the two tasks that genuinely need secrets last.
A draft has been in the repo since E1.9 with the first two parts. It has no secrets section, and it
describes fourteen ADRs and a populated seed, neither of which exists yet (E22.6, E15.1–E15.2).
⬜ **E15.5 — Freshness test for the seed** · S · Deps: E15.2 — _AC:_ CI fails if a migration lands that the seed no longer satisfies.

---

## E16 — Web foundation, auth, dashboard shell

Phase 1. Stream J. Deploy on day one.

✅ **E16.1 — Next.js app scaffold with Tailwind and shadcn** · M · Deps: E1.1
_Outstanding:_ Tailwind v4 is in; `components/ui` is hand-written in shadcn's style rather than generated by its CLI, so no Radix dependency has been taken yet. Run the CLI when a primitive needs real accessibility behaviour (dialog, popover, select) rather than ahead of it.
✅ **E16.2 — Supabase client setup, server and browser** · M · Deps: E13.1 — _AC:_ the service-role client is importable only from server contexts (guarded by E1.7).
_Note:_ three server clients and no browser client. `createPublicClient` is anonymous by
construction, `createServiceRoleClient` bypasses RLS, and `createSessionClient` (E16.2, `@supabase/ssr`)
carries the session cookies so `auth.uid()` is populated. There is no browser client because nothing
needs one yet: sign-in and sign-out are form POSTs to route handlers, so the whole flow works with
JavaScript disabled and no `'use client'` module can reach a Supabase key at all. `proxy.ts` (Next 16's name for
`middleware.ts`) refreshes the token — a Server Component cannot set cookies, so without it an hour-old session is
silently signed out mid-visit.
✅ **E16.3 — Discord OAuth login and callback** · M · Deps: E16.2
_Note:_ shipped Discord-only, per §17 as it then read. **Superseded by E16.9**, which makes Discord
one option among four and no longer the door — §17 has been rewritten to match. What survives
unchanged from this story is the OAuth half: `/auth/callback`, and `safeNextPath` validating `next`
before it reaches a `Location` header, without which the login page is an open redirect.
✅ **E16.4 — `profiles` bootstrap on first login** · S · Deps: E16.3
_Note:_ a trigger on `auth.users` (migration 0016), not an upsert in the callback. Every table that
attributes anything points at `profiles`, so the row is created by the same statement that creates
the user rather than by whichever code path runs next — which also covers an account made from the
Supabase dashboard. The migration backfills accounts that predate it, so "signed in with no profile"
is unreachable rather than handled. `handle` is left null: a Discord username is not unique, and
claiming one on sign-up would hand the first arrival a name the second could never have.
✅ **E16.5 — Role-aware route guards** · M · Deps: E16.4 — reader / writer / organizer / admin.
_Note:_ the call site is the declaration. `requireViewer()` and `requireRole(role)` are called as the
first statement of a page or layout, and there is no registry of protected routes — a new page under
`/dashboard` cannot be left open by forgetting to add it to a list it does not know exists. Signed
out redirects to `/login` with the destination remembered; signed in and short of the bar goes to
`/unauthorized`, which is a page rather than a bounce home so that a permission is distinguishable
from a broken link. The ladder itself is `core/auth/meets-role`, so it is testable with no
credentials. `proxy.ts` refreshes the session and decides nothing — the comment there says why.
✅ **E16.6 — Dashboard shell and navigation** · M · Deps: E16.5
_Note:_ the shell and the role-aware nav, with all four sections listed and none of them built —
they are E20.2, E20.15, E20.16 and E20.18. Listed rather than hidden, the same way the main nav
lists `/meta`: the shape is worth advertising to the people who will use it. The layout guards at
`writer`, the lowest rung with anything to do here, and each section will guard itself again at what
it actually needs, because a layout cannot express "organizer here, admin there".
⛔ **E16.7 — Deploy pipeline and preview environments** · M · Deps: E16.1 — _AC:_ production deploy from `main`, preview per PR, environment variables documented.
_Blocked:_ needs the hosted Supabase project's URL configuration, which is a dashboard setting and not
a file in this repository. The four settings and why each one fails silently are written up under
_Configuring a deployment_ in [`docs/modules/auth.md`](docs/modules/auth.md); what is left for this
story is making the preview environments work against them.
✅ **E16.10 — Account deletion** · M · Deps: E16.9 — _AC:_ erasure removes every identifying field and
the account itself, in one transaction, and cannot be aimed at anybody else.
_Note:_ the profile is **not** deleted — eight tables reference it and two of those columns are
`not null`, so the schema will not allow it, and an article the community still reads is not the
leaving member's to withdraw. It becomes a tombstone: identifying fields cleared, `user_id` severed,
byline reads "Deleted member". The regulation asks for erasure of personal data, not of rows.
_Note:_ the scrub is a `before delete` trigger on `auth.users`, not a step in the erase function, so
**every** deletion route erases — including an admin deleting a row from Supabase Studio, which would
otherwise sever the link and leave the name sitting there. `before` and not `after` because
`user_id` is `on delete set null` and an after-trigger could no longer find the profile.
_Note:_ `erase_profile(uuid)` is revoked from `anon` and `authenticated` **by name**. Supabase's
default privileges grant execute on every new `public` function to both, and `revoke ... from public`
does not remove those — it was callable by any signed-in user with any uuid until this was fixed, and
`repos/profiles` now asserts it is not.
✅ **E16.11 — Data export** · S · Deps: E16.10 — _AC:_ one JSON download covering Articles 15 and 20.
_Note:_ read through the person's own client rather than service-role — every query is one they are
entitled to make, so RLS is a second opinion rather than an obstacle. Includes unpublished drafts: a
draft nobody else can see is still theirs. `notHeldHere` names what is held elsewhere and how to ask,
because a right of access is only honoured if you can tell what is missing.
✅ **E16.12 — Privacy notice** · S · Deps: E16.11 — `content/pages/privacy.mdx`, UK and EU GDPR.
_Note:_ an info page by §25's split rule even though §25 predates the site holding anybody's data —
it describes how the site works and should not change without a review. States the lawful bases
(contract for the account, legitimate interests for abuse prevention), the processors, retention, and
what deletion does not remove. **No consent banner:** the one cookie is the session, which is
strictly necessary, and there is no analytics or advertising to consent to.
✅ **E16.9 — Email, magic link, and Google sign-in** · L · Deps: E16.5 — four ways in, none required;
email confirmation; password reset. _AC:_ a contributor can sign up, sign in, and reset a password
with no external account registered anywhere.
_Note:_ added after E16.3 shipped, because Discord-only was the wrong call — it made "join our chat
server" a precondition for writing anything, and the site is readable without an account precisely
so that it is not a club. Discord stays as one provider among several, and its real use — knowing
which member a player is — moves to a later, opt-in pairing (`identity_source` already has
`discord_oauth`; `linkIdentity` attaches one to an existing account). Which buttons appear comes from
Supabase's `/auth/v1/settings`, so a provider is a dashboard toggle rather than a deploy.
_Note:_ `enable_confirmations` is now on and is load-bearing, not tidy — Supabase links identities
sharing an email, so an unconfirmed password account on somebody else's address would be waiting to
be linked to their Google sign-in. It also makes real SMTP a **production dependency**: two of the
four ways in are an email, as is every reset, and the built-in sender is a few messages an hour.
_Note:_ the four auth emails are ours (`packages/db/templates/`) because the defaults return the
session in a URL fragment, which a server-rendered site cannot read. Three separate traps in editing
them are written up in `docs/modules/auth.md`; each one had already been hit.
_Outstanding:_ Discord identity pairing is designed, not built — no story owns it until a feature
needs it. Google and Discord are verified against the settings endpoint and the local config, but
neither has been run against a real provider application; the email flows have been run end to end.
_Note:_ role granting was an `update` in the SQL editor until `/admin/users` (E20.21).
_Note:_ account deletion, data export and the privacy notice landed as E16.10–E16.12.
✅ **E16.8 — Error, empty, and loading states as shared components** · S · Deps: E16.1
✅ **E16.13 — Local sign-in as any seeded account** · S · Deps: E16.9 — _AC:_ under `next dev` the
header offers one-click sign-in as each seeded account, covering every rung from reader to admin; no
production build renders it.
_Note:_ the switcher posts the seed password to the ordinary `/auth/password` route rather than
minting a session, so it adds no way in that production lacks. Adds a `reader` seed account, the one
rung the seed did not cover.
✅ **E16.14 — The Planar Compass look** · L · Deps: E16.1 — the site takes its iconography from the
original logo: the vortex mark, its compass star and its ring of stars. _AC:_ one palette (parchment
to night, gold for the format, violet for links) and three self-hosted faces; the ledger pages are
night in both themes and the reading pages follow the reader; no route or data changes.
_Note:_ added outside the plan, from the proposal on the design canvas. `components/ui/planar-mark.tsx`
is the logo traced to one path. A `.night` class makes any region use the `dark:` palette
(`globals.css`), so the header, footer, home hero, `/leaderboard`, `/events` and the tournament
component went night without per-component colours. `components/ui/marks.tsx` holds the compass star,
the season ring (a star a month, `core/events/season-progress`), the star rule, dotted leaders and `Placement`;
`PageHeader` is shared by the ledger pages. The leaderboard's two tables became tabs. The home page is
now a hero with the next event, the podium as separate cards, then news beside community posts, which
replaces E24.1's grid.

---

## E17 — MDX info pages

Phase 2. Stream I. Several of these need no code at all.

✅ **E17.1 — MDX wiring with a whitelisted component set** · M · Deps: E16.1 — _AC:_ MDX executes, so the allowed component list is explicit and tested.
_Note:_ not `@next/mdx`. That loader only compiles `.mdx` inside `app/`, and §25 puts these in
`content/pages/` — `@mdx-js/mdx` is the same pipeline called directly, and one reader then supplies
both the nav and the body. The whitelist is enforced on the compiled tree by
`remarkInfoPageWhitelist`, **not** by MDX's `components` prop: that prop only intercepts
Markdown-derived elements, so a literal `<script>` compiles straight past it.
✅ **E17.2 — `<LegalSets />`** · S · Deps: E17.1, E13.15
_Outstanding:_ set codes only. The names (`FDN` → Foundations) live in `data/cards/`, which E4.7's loader now reads, so this is a sitting's work; the hand-written role column on `/rules` is gone rather than being carried alongside live data it would contradict.
✅ **E17.3 — `<Banlist />`** · S · Deps: E17.1, E13.15
_Outstanding:_ a rule renders its `oracle_id`, not the card's name — `oracle_id` carries no foreign key by design (§14.1) and the name comes from `data/cards/`, which E4.7's loader now reads. This matters since E20.33: an admin bans a card by name at `/admin/formats` and `/rules` shows its id. The empty banlist, which is the state today, renders in full.
⬜ **E17.4 — `<Chart />` embed** · M · Deps: E17.1, E19
✅ **E17.5 — `/(info)/[...slug]` route and nav generation** · M · Deps: E17.1 — pages are prerendered from `generateStaticParams`; the footer nav is generated from frontmatter `navOrder`.
_Note:_ the route became `force-dynamic` at E17.2. `generateStaticParams` still enumerates the pages, so `dynamicParams: false` still 404s an unknown slug, but `/rules` reads the format tables and a pool or a ban baked at build time is the staleness those rows exist to prevent.
✅ **E17.6 — Page: about** · S
✅ **E17.7 — Page: rules** · M
✅ **E17.8 — Page: getting-started** · S
✅ **E17.9 — Page: faq** · S
✅ **E17.10 — Page: organizers** · M — include the melee 60-day export warning
✅ **E17.11 — Page: resources** · S
✅ **E17.12 — Page: methodology** · M · Deps: E6.8 — _AC:_ metric definitions verbatim from `docs/modules/metrics.md`; a test asserts the two do not drift.
The doc carries `publish:start` / `publish:end` / `publish:omit` markers; `pnpm content:sync` rewrites the page's generated region and the test fails when the two disagree.
✅ **E17.13 — Page: ratings-explained** · M · Deps: E8.4 — published the same way, from `docs/modules/ratings.md`.

---

## E18 — Services

Thin coordinators only. If a service contains business logic, that logic belongs in `core`.

### import-results

⬜ **E18.1 — Upload, hash, archive raw bytes** · M · Deps: E13.18 — _AC:_ content-hash idempotency; raw bytes archived permanently.
⬜ **E18.2 — Detect adapter and parse to staging** · M · Deps: E18.1, E12.1 — _AC:_ `raw jsonb` retained per row so parser fixes re-run without the original file.
✅ **E18.3 — Resolve handles to identities** · L · Deps: E18.2, E13.19 — auto-create on miss; record method and confidence per side.
_Note:_ built ahead of E18.2, over an event's handles rather than its staged rows, because the
API path (E18.20) does not stage. `core/identity/resolve-handles` decides — reuse the platform's
identity on an exact normalized match, else attach to the one player another platform knows by it,
else create — and `lib/results/resolve-handles.server.ts` carries it out, with
`listIdentitiesByNormalized` as the one read. Two handles in one event that normalize alike get no
identity and an error, since joining them would have someone play themselves; a handle two players
hold elsewhere creates rather than guesses. `core/identity/player-slug` names new players, and the
service retries `-2`, `-3`… when a slug is taken.
_Outstanding:_ method and confidence per side are not written. Every resolution is an exact match,
so there is nothing to record yet; the staged upload path writes them through `resolveStagedMatch`
when E18.2 and E18.4 use this.
⬜ **E18.4 — Review queue UI contract and commit** · L · Deps: E18.3 — staged → `matches`; sets `is_rated` from capabilities.
⬜ **E18.5 — Supersede on re-import** · M · Deps: E18.4 — _AC:_ wholesale replacement, never a merge; prior import marked `superseded`.
⬜ **E18.6 — Corrections with audit and recompute** · M · Deps: E18.4 — _AC:_ reason required; writes `match_corrections`; triggers recompute; Discord notice if a public rank moves.
✅ **E18.20 — `ingest-completed-event`** · L · Deps: E8.7, E12.10, E18.3, E18.12 — what
`onTournamentCompleted` (E23.13) does: fetch, parse, write the tournament, resolve handles, commit
matches, then run two independent follow-ups — ratings (E18.12) when the tournament is rated, and deck
processing (E18.13–E18.15) when it has decklists, which on melee.gg is sometimes and on Challonge
never. _AC:_ every finished event is ingested, and only rated ones feed Elo; a handle resolves to an
existing player **only** on an exact normalized match (E9.1) — same platform first, then any platform
— and otherwise creates a new player, so fuzzy signals (E9.2–E9.6) never merge anything on their own;
an API import commits straight to the ledger without E18.4's review queue, because resolution is
deterministic; re-ingesting an event supersedes it (E18.5).
_Note:_ `lib/results/ingest-event.server.ts` does it for any adapter's `ParsedEvent`, and
`onTournamentCompleted` feeds it melee.gg events through `lib/melee/results-input.server.ts`.
Migration `0025_tournament_source.sql` adds `tournaments.source` / `external_id` so a re-ingest
finds its row; `saveSourcedTournament` refreshes what the platform knows and keeps what people
decided — slug, `is_rated`, a status past `results_imported`. A tournament is rated when
`rated-by-default` says so **and** it has pairings. Identical bytes are an idempotent no-op (the
content hash); staged rows are written with `raw` for provenance. `core/results/ledger-matches`
leaves out a match with no result or an unresolved side, and every issue lands in
`result_imports.errors`. `onFullRerun` now rebuilds the ladder from the ledger. Challonge events
are marked processed with nothing done until E12.14.
_Outstanding:_ the deck path is a named no-op (`onDecklistsIngested`) until E18.13–E18.15.
`tournament_entries` is written since E18.21. The assembled payload is not archived
(E18.1 has not chosen where raw bytes live); melee.gg can be asked again, which "Re-run everything"
does.

✅ **E18.21 — Standings from an ingest** · M · Deps: E18.20 — every ingest writes the event's
`tournament_entries`: one per player, with a placement and a record. _AC:_ the source's placements
when it reported any, else a clean single-elimination playoff's (1, 2, then 3 shared); a record the
source did not give is tallied from the pairings; a re-ingest keeps each entry's id and deck, so a
merge's undo still finds them; an already-committed payload still writes its standings, so events
ingested before this gain them on a re-run.
_Note:_ `core/results/event-entries` decides, `replaceTournamentEntries` upserts on
`(tournament_id, player_id)` and prunes, and `resolveEventHandles` now returns each handle's player.

### import-decklists

⬜ **E18.7 — Folder-drop path with filename metadata** · M · Deps: E3.6, E13.16
⬜ **E18.8 — Self-service paste path** · M · Deps: E3.5, E16.5
⬜ **E18.9 — Organizer entry path** · M · Deps: E13.17
⬜ **E18.10 — Unresolved-card handling** · S · Deps: E5.2 — _AC:_ row kept, deck flagged, deck excluded from `card_stats` until fixed.
⬜ **E18.11 — Deck lock on event start** · S · Deps: E13.7 — ADR 013.

### recompute

✅ **E18.12 — `recompute-ratings`** · L · Deps: E8.4, E13.20 — full replay resolving identities at read time; writes `rating_runs`. ADR 004.
_Note:_ the ladder is the **current season's** rated matches, a product decision taken with this
story, so `repos/seasons` arrived with it (`getCurrentSeason`, and `findSeasonForDate` for E18.20).
With no current season the recompute empties the ladder rather than keeping a stale one — and
production has none until E20.35, since `db push` never seeds. `lib/ratings/recompute-ratings.server.ts`
takes a `trigger` string for `rating_runs`; its test stubs the repositories, because a real
recompute replaces every rating and would pull them out from under the db suites running beside it.
⬜ **E18.13 — `recompute-metrics`** · L · Deps: E6.7, E13.21 — deck metrics, card stats, archetype stats.
⬜ **E18.14 — `recompute-similarity-and-layout`** · M · Deps: E7.4, E13.21
⬜ **E18.15 — `recompute-matchups`** · M · Deps: E13.9, E10.1 — requires `tournament_entries`; degrades to empty when the deck link is missing.

### other

✅ **E18.16 — `merge-players`** · L · Deps: E13.19 — repoint identities, recompute, write `player_merges.moved`. _AC:_ co-appearance exclusion blocks the merge at service level; reversible.
_Note:_ `lib/identity/merge-players.server.ts`. The co-appearance check reads the ledger through
`listIdentityAppearances` and `core/identity/merge-blockers`, not `identity_exclusions`, which
nothing writes yet; `merge-blockers` asks every event rather than once per pair of handles, so a
refusal names each shared event. Reversible is `undoMerge`: migration `0027_merge_undo.sql` adds
`player_merges.undone_at` / `undone_by`, and `undoPlayerMerge` moves back exactly the ids in `moved`.
An undo is refused once either player has been merged again. Runs with the service-role client, since
it moves decks and standings. `PlayerMerge` gains `undoneAt` / `undoneBy` in `@ps/contracts`.
⬜ **E18.17 — Merge-suggestion generation job** · M · Deps: E9.8, E18.16
⬜ **E18.18 — `publish-post`** · M · Deps: E13.22 — status transition plus Discord notify.
⬜ **E18.19 — `notify-discord`** · S — webhook wrapper with a no-op mode when the secret is absent.

---

## E19 — Chart components

Stream H. Each takes already-shaped data as props and renders in Storybook from a fixture with no database.

⬜ **E19.1 — Storybook setup and fixture conventions** · M · Deps: E16.1
⬜ **E19.2 — Shared rate-display primitives** · M · Deps: E10.3 — a component that renders a rate with its `n` and Wilson interval, or suppresses it. Every rate on the site goes through this.
⬜ **E19.3 — `MetaShare`** · M — 100% stacked area; archetype / family / supertype toggle, default family.
⬜ **E19.4 — `ArchetypePerformance`** · M · Deps: E19.2 — sorted by deck count, Wilson bars, `n` per row, n<3 collapsed.
⬜ **E19.5 — `ManaCurve`** · S — per deck and per archetype against field average.
⬜ **E19.6 — `ColorDistribution`** · M — pie per event and share over time, `mana-font` symbols.
⬜ **E19.7 — `SetAdoption`** · M — stacked area.
⬜ **E19.8 — `CardScoreTable`** · L — TanStack Table; win-rate column suppressed under 20 games; label is "win rate of decks including this card".
⬜ **E19.9 — `CardInclusionSparkline`** · S
⬜ **E19.10 — `ArchetypeMap`** · L · Deps: E7.4 — Canvas, server-computed layout, size = games played, colour = family, `?highlight=` lights every deck running a card.
⬜ **E19.11 — `MatchupMatrix`** · M · Deps: E19.2 — heatmap, grouped by family by default.
⬜ **E19.12 — `RatingHistory`** · M
⬜ **E19.13 — `DeckVisualizer`** · M — a text list, not an image grid: count, name and
mana cost per line, grouped **Spells | Lands | Sideboard**. Lands are listed with an empty cost
column. Hovering a line shows that one card, uncovered and unmodified; clicking opens its Scryfall
page in a new tab. _AC:_ no cropped, filtered or overlapped card images anywhere in the component —
Scryfall's image terms, and the reason this is a list rather than a grid. Takes shaped lines as
props like every E19 component, so it needs no card data of its own — resolving names against the
index is E20.6's job.
⬜ **E19.14 — Chart-rules lint test** · S · Deps: E19.2 — _AC:_ asserts every rate-displaying component imports the shared primitive.

---

## E20 — Feature slices

Slices own their routes, components, and hooks; they never import from each other.

✅ **E20.1 — `auth` slice** · M · Deps: E16.3
_Note:_ `/login` plus the three `/auth/*` route handlers, and `AccountNav` in the site header. The
slice owns no client components — see E16.2.
✅ **E20.2 — `content`: `/articles/*` and MDXEditor** · L · Deps: E18.18
_Note:_ a Markdown textarea with Write / Preview / Reddit / Discord tabs, not MDXEditor. The body is
Markdown by ADR 001, and a rich-text editor would have to round-trip `:::name{…}` components
through its own model; a textarea cannot garble them. The preview is a server action that returns
the published page's own `PostArticleContent`, so components can load data and the preview cannot
drift from the page. Built without E18.18: the status transition is `savedStatus` and RLS; the
Discord notice on publish is still E18.18's.
_Outstanding:_ saving does not write `post_revisions` — the table still takes no writes (E14.5), and
edit history needs deciding (every save, or only after publication) before a policy is written.
✅ **E20.3 — `content`: "Copy for Reddit" button** · S · Deps: E11.6, E20.2
_Note:_ it is the editor's Reddit tab, with a Discord one beside it, both through
`core/content/export-post` so components expand first.
⬜ **E20.4 — `cards`: `/cards` browse, filter, sort** · L · Deps: E4.7 — _AC:_ filtering happens in-app against the loaded index, not in SQL.
⬜ **E20.5 — `cards`: `/cards/[oracleId]` detail** · M · Deps: E19.9, E20.4
✅ **E20.6 — `decks`: `/decks/[id]`** · M · Deps: E19.13
_Note:_ built before E19.13, and with card images rather than E19.13's text list, because the deck page
was asked to show the cards. Each image is Scryfall's `normal`, whole and uncovered, with the count
beneath it and a link to Scryfall; the text list is a `<details>` under the grid. Legality is checked
live against the current format (`checkDeck`), so a later ban shows without a re-save. Sections come
from `core/decklist/deck-sections`, the picture from `pick-printing`. E19.13 can still replace the
grid's text half when it lands.
⬜ **E20.7 — `decks`: submission flow** · M · Deps: E18.8
⬜ **E20.8 — `meta`: `/meta`** · M · Deps: E19.3, E19.4
⬜ **E20.9 — `meta`: `/meta/map`** · M · Deps: E19.10
⬜ **E20.10 — `meta`: `/meta/cards`** · M · Deps: E19.8
⬜ **E20.11 — `meta`: `/meta/matchups`** · M · Deps: E19.11
✅ **E20.12 — `leaderboard`: `/leaderboard`** · M · Deps: E13.20
_Note:_ two tables, not one: **Ranked** from the `leaderboard` view, and **Not ranked yet** from a
new `provisional_ratings` view — `leaderboard`'s complement under the same visibility rules, so a
shown player is in exactly one — read by `getProvisionalRatings`. Migration
`0026_provisional_ratings.sql` also lowers `rating_config` to 5 rated matches for both provisional
and ranking, so a player ranks after about one Monthly rather than three; `/ratings-explained` says
so. The page shows a record rather than a win rate, so no rate needs `suppress-small-n`. Names are
not links yet — `/players/[slug]` is E20.13. The header's Leaderboard link is live.
⬜ **E20.13 — `leaderboard`: `/players/[slug]`** · M · Deps: E19.12
⬜ **E20.14 — `tournaments`: `/tournaments/[slug]`** · M · Deps: E13.17
⬜ **E20.15 — `tournaments`: import dashboard** · L · Deps: E18.4
✅ **E20.16 — `identity-admin`: merge grid** · L · Deps: E18.16
_Note:_ `/admin/players`, not a dashboard page — the other admin slices already live under `/admin`.
Every unmerged player with their handles and rating, searchable by name or handle
(`listPlayersForMerging`); tick players, choose the one to keep, add an optional reason, and they
merge one by one, stopping at the first refusal and saying which events blocked it. Recent merges
list below with Undo. Server components and forms only, so no client module reaches the
service-role action.
⬜ **E20.17 — `identity-admin`: CSV round-trip** · M · Deps: E20.16
✅ **E20.18 — `format-admin`: `/dashboard/format`** · L · Deps: E13.15 — _AC:_ validates `format_legal_sets` against `data/sets.json` and warns when a selected set is absent from the dataset; bans and exceptions editable without a deploy.
_Note:_ delivered by E20.33 at `/admin/formats`, not `/dashboard/format`. The legal sets are checkboxes
over the sets the card data holds; a set it does not hold can only be typed into a separate field
labelled for exactly that, which is the warning, rather than a message after the fact.
⬜ **E20.19 — Site search** · M · Deps: E20.4
✅ **E20.20 — `auth`: `/profile`** · M · Deps: E16.5 — the page every signed-in account has: display
name, handle, bio, role, and what that role can do. _AC:_ a person may edit their own profile and
may not change their own role.
_Note:_ added at E16.5 rather than planned — §11.2 gives the `auth` slice login and callback, and an
account with nowhere to go after signing in is not a finished flow. The handle is optional and
validated by `core/auth/profile-handle`; role escalation is refused by `profiles_self_update`'s
`with check` clause, asserted from the signed-in side in `repos/profiles`. The form is a server
action with no client component, so it works with JavaScript off like the rest of the slice.
✅ **E20.21 — `admin`: `/admin` and `/admin/users`** · M · Deps: E14.7 — an admin-only area with a
section per job; the first changes roles and bans members. _AC:_ each section is a row in
`lib/auth/admin-sections.ts`; an admin cannot act on themselves.
_Note:_ added outside the plan. The review queue is listed as an admin section but lives at
`/dashboard/review`, because writers review too and `/admin` is admin-only.
✅ **E20.22 — `content`: submission and review queue, scaffolded** · M · Deps: E14.6 —
`/dashboard/articles` (any member) and `/dashboard/review` (writer and up). _AC:_ a reader's
submission waits for approval, a writer's publishes, and approval or return happens from the queue.
_Note:_ submitting sends a generated sample (`lib/content/sample-article.ts`) instead of real input.
The status decision, the policies and the queue are real; E20.2 has since replaced the sample with the editor.
The dashboard now admits every member, not only writers, since anyone may submit.
✅ **E20.23 — `content`: article components, scaffolded** · M · Deps: E20.2 — _AC:_ a component is
one line (`:::name{…}`); adding one is a core definition plus a site renderer, and it cannot compile
without a Reddit and a Discord export; planned ones are listed in the editor with how each exports.
_Note:_ no component is live. `core/content/embed-*` holds the syntax, the registry and the catalogue;
`web/components/content/embeds` the renderers. Submission refuses a component that is not live, so
nothing unrenderable is published. How to add one: [`docs/modules/content.md`](docs/modules/content.md).
✅ **E20.24 — Decklist component** · M · Deps: E20.23, E19.13, E20.7 — `:::decklist{id}`; the picker
lists the author's own decks first. _AC:_ Reddit gets a link and the list as text; Discord a link
with the deck's name and record.
_Note:_ built on E20.6's deck sections rather than E19.13's `DeckVisualizer`, which does not exist
yet. Reddit's list is a four-space indented block so every line survives and pastes into a client.
Discord gets the name and card counts: a deck on its own has no record. A private deck renders for
its owner only, with a note that readers cannot see it.
✅ **E20.25 — Image component** · M · Deps: E20.23 — `:::image{src alt caption}`. Needs a decision on
where uploads are stored (Supabase Storage is the obvious one) and on size limits.
_Note:_ decided: a public `post-images` Storage bucket (migration `0028_post_images.sql`), a folder
per writer's auth id enforced by policy, 4 MB of PNG, JPEG, WebP or GIF — under Vercel's 4.5 MB
request cap, which the upload server action passes through. An image can also be linked by address.
Alt text is required.
✅ **E20.36 — Tournament component** · M · Deps: E20.23, E20.24, E18.21 —
`:::tournament{slug show deck player}`: an event's winner, top 2 or top 4 as one card, with a deck
either under a finisher or paired beside the results. _AC:_ on the site the deck sits inside the
tournament card; every export writes the event and its finishers, then the deck separately, the way
the decklist component does; an event with no standings says so rather than showing an empty list.

⬜ **E20.26 — Card component** · S · Deps: E20.23, E4.7 — `:::card{name}`, resolved against the card
index. _AC:_ exports as the name linked to Scryfall.
✅ **E20.27 — `content`: "Articles" becomes "Community", with a way in from every feed** · S · Deps:
E20.2 — _AC:_ `/articles` answers at `/community`, and every old link still works; each feed offers
the editor to whoever may use it.
_Note:_ the feed, the nav, the dashboard section (`/dashboard/community`) and the copy say
"community post", because the feed is about community involvement rather than a publication's
articles. `/articles`, `/articles/:slug` and `/dashboard/articles/*` redirect permanently: every
Reddit export already ends in a link to the old path. The post `kind` was already `community`, so
no data moved. The editor's code went generic (`PostEditor`, `savePost`), since it writes news too:
`?kind=official` opens it for a news post, admins only. Signed out, the Community feed offers
"Sign in to write a community post" and returns to the editor after; News shows its button to
admins and nobody else. Story titles above that name `/articles` are left as written.
✅ **E20.28 — `decks`: import a deck from a text list** · M · Deps: E4.7, E13.16 — `/decks`,
`/decks/new`. _AC:_ any member pastes `4 Card Name` lines (a `Sideboard` line splits the boards);
every line must parse and every name resolve, with "did you mean" on a miss; the deck is theirs at
the visibility they chose, and a private one is invisible to everybody else.
_Note:_ added outside the plan, ahead of E20.7's organizer registration. `core/legality/resolve-deck`
and `check-deck-import` decide; `0020_member_decks.sql` lets a member insert, read and delete their
own deck, and not set its player, lock or legality verdict. `create_deck` is an invoker RPC so the
deck and its list are one transaction. Other formats arrive as adapters behind the same form.
✅ **E20.29 — `decks`: a deck reads as a text list, with images a click away** · S · Deps: E20.6 —
_AC:_ `/decks/[id]` opens as a text list by section, flowed into as many columns as the screen fits;
each name links to Scryfall and shows its card on hover; a button switches to the image grid and back.
_Note:_ added outside the plan. The layout is `?layout=images` in the URL, so the page stays
server-rendered and either view can be linked; the hover preview only shows where the device can hover.
✅ **E20.30 — `decks`: edit a deck, keep its history, and choose its format** · M · Deps: E20.28 —
`/decks/[id]/edit`. _AC:_ an owner edits their latest version and saving writes a new deck whose
parent is the old one, which stays at its URL; the deck page lists every version; a deck is Planar
Standard (checked against the version in force) or Kitchen Table (anything goes); the editor shows
why a list is not legal as it is typed, and saves one anyway after a confirmation. The deck page
shows the format with ✓ or ✗ and nothing more.
_Note:_ added outside the plan, and separate from a tournament registration's lock-and-fork (ADR 013).
`0021_deck_versions_and_formats.sql` adds `decks.format` and `decks_one_successor`, so a history is a
line, not a tree. Deleting a deck deletes every version, after a confirmation. A name that does not resolve no longer blocks
a save, which changes E20.28: Kitchen Table allows cards outside the dataset, so an unknown name is
reported with suggestions, confirmed, and stored unresolved.
✅ **E20.31 — `decks`: remove versions of a deck, keeping the rows** · S · Deps: E20.30 — _AC:_ the
owner picks which versions to remove in a dialog; the versions kept are relinked into one line; a
removed version is gone from every page, list and history, and still in the database; one a
tournament entry names stays public wherever that entry is.
_Note:_ added outside the plan. `0022_hide_deck_versions.sql` adds `decks.hidden_at` and drops the
member delete policy, so a member can no longer delete a deck at all. `hide_deck_versions` is a
definer function because `decks` has no update policy. The owner can still read hidden decks, which
the data export needs (E16.11). "Delete" is the member's word for it; nothing is deleted.
⬜ **E20.32 — `decks`: a member's tournament decks, as a tab beside their own** · S · Deps: E20.31,
a player linked to the profile (`players.profile_id`) — _AC:_ `/decks` has a "Tournament decks" tab
listing the decks the member's player registered, from `listDecksByPlayer`, whether or not the member
removed a copy from their own decks.
✅ **E20.33 — `admin`: create, edit and delete format versions** · M · Deps: E14.4, E20.21 —
`/admin/formats`. _AC:_ an admin lists every version with the one in force marked; creates or edits a
version's name, dates, notes, legal sets, deck limits and card rules (by card name, with "did you
mean"); marks one in force, which un-marks the old one; and deletes a version that is not in force
and that nothing was checked against.
_Note:_ added outside the plan, so a production database can get its format without SQL — `db push`
applies migrations and never seeds. `0023_admin_format_versions.sql` adds `save_format_version` and
`delete_format_version`, both security invoker so the E14.4 admin policies decide.
`core/legality/check-format-draft` checks the form. `extra_rules` has no editor yet and is kept as it is.
⬜ **E20.34 — `admin`: rate or unrate a tournament** · S · Deps: E8.7, E18.12 — flip
`tournaments.is_rated` after E8.7 guessed it, and recompute. _AC:_ admin-only; the leaderboard
reflects the change once the recompute finishes, with no deploy.
✅ **E20.35 — `admin`: open and close seasons** · S · Deps: E18.12 — create a season, set its dates,
mark it current. _AC:_ the leaderboard is scoped to the current season (E18.12), so marking a new
one current recomputes, and the ladder resets with no deploy; an event's season comes from its date
(`findSeasonForDate`).
_Note:_ `/admin/seasons` lists, creates and edits; there is no delete, since tournaments and decks
reference a season. `core/events/check-season-draft` refuses overlapping seasons, ends inclusive, so
a date belongs to at most one. `saveSeason` also re-files tournaments by date — events ingested
before their season existed join it — and every save recomputes. The form receives its action as a
prop: the action reaches the service-role client, and `check-server-only` refuses a client module
that imports it. `SeasonDraft` is new in `@ps/contracts`. The season's format version is not on the
form and stays as it was.

---

## E21 — Season II backfill

A standalone script outside the main app, per the answer to open question 5. Run once, then delete or archive.

⬜ **E21.1 — Scrape 98 decklists from the archetype map HTML** · L · Deps: E12.7 — player, date, both records, full list from hover text.
⬜ **E21.2 — Cross-check records against per-date xlsx sheets** · M · Deps: E12.6 — _AC:_ summary sheets ignored; mismatches reported, not silently reconciled.
⬜ **E21.3 — Auto-create identities and mine trailing parentheticals** · M · Deps: E9.2, E18.3
⬜ **E21.4 — Build exclusions from co-appearance across all nine events** · S · Deps: E9.7
⬜ **E21.5 — Run the suggestion engine and work the queue once** · M · Deps: E18.17, E20.16
⬜ **E21.6 — Confirm ratings stay empty** · S · Deps: E12.8 — _AC:_ no rated tournament exists until an event with real pairings is imported.

---

## E22 — Governance, docs, and the four load-bearing tests

✅ **E22.1 — Licence decision and file** · S — MIT or Apache-2.0, before the first external PR.
⛔ **E22.2 — Contributor Covenant CoC** · S
_Blocked:_ needs a contact address for the enforcement section.
⛔ **E22.3 — `CODEOWNERS` per `area:` label** · S
_Blocked:_ needs the GitHub org/team handle for each `area:` label.
⬜ **E22.4 — Issue labels and templates** · M — the nine `area:` labels plus `good first issue` templates for: new adapter, new identity signal, new Reddit transform, new decklist edge case, new chart, new MDX page.
✅ **E22.5 — PR template encoding the Definition of Done** · S — the §19 checklist verbatim.
⬜ **E22.6 — ADRs 001–014** · L — one short file each. _Split into three PRs of four or five if review drags._
⬜ **E22.7 — `docs/modules/` index** · S — one page per module, linked from each module README.
The index exists (`docs/modules/README.md`), with one page per area rather than per module; 23 of the
102 module READMEs link to it.

### Release-blocker tests

These four are called out in §22. Write them as early as their dependencies allow and treat breakage as a release blocker.

⛔ **E22.8 — `metrics-golden.test.ts`** · L · Deps: E6.7, E21.1 — import the `2026-08-01` decklists, assert computed `deck_metrics` match the existing spreadsheet column for column.
_Blocked:_ needs the community spreadsheet to assert against.
⬜ **E22.9 — `replay-identity.test.ts`** · L · Deps: E18.12, E18.16 — two handles with separate histories produce two ratings; bind them to one player, re-run, assert one merged rating **and that no row in `matches` changed**. Encodes ADR 003 and 004.
✅ **E22.10 — `rls.test.ts`** · see E14.5.
_Note:_ delivered as E14.5, at `packages/db/rls.test.ts` rather than under `tests/`.
⬜ **E22.11 — `dataset-integrity.test.ts`** · M · Deps: E4.4, E13.12 — every `oracle_id` in Postgres exists in `data/cards/`; every set in `format_legal_sets` is present in `data/sets.json`. This replaces the foreign keys the card tables would have provided.
⬜ **E22.12 — Playwright end-to-end happy path** · L · Deps: E15.2, E20.15 — import an event, commit it, see the leaderboard move.

---

## E23 — Upcoming events

New. A read-through cache of the community's calendars — Challonge and melee.gg — published as one
schedule with a link out to each event's own page. The site advertises events; the platforms still run
them, so there is no join, no leave, and no account linking — that whole flow from the previous site
is deliberately not carried over.

Two constraints shape every story below.

- **The credentials are production-only secrets.** `CHALLONGE_API_KEY`, `CHALLONGE_COMMUNITY`,
  `MELEE_CLIENT_ID` and `MELEE_CLIENT_SECRET` live in Vercel and nowhere else. Nothing in `packages/`
  may read them, no contributor needs them, and every test in this epic runs with none set. Locally
  the page renders from the seed.
- **The API budget is 500 requests a month.** That is ~16 a day. The refresh interval is therefore one
  named constant with the arithmetic written next to it, and the window is claimed _before_ the fetch,
  so an outage costs one request per window rather than one per page view.

✅ **E23.1 — `contracts/events`** · S · Deps: E1.1 — `ExternalEvent`, `ExternalEventState`,
`EventSource`, `EventSyncState`, `EventSchedule`. A ninth module in the §7 table.
_AC:_ `ExternalEvent` carries no Challonge-shaped field — a second source is a new parser, not a
contract change.

✅ **E23.2 — `core/events/parse-challonge-events`** · M · Deps: E23.1 — the v2.1 JSON:API list payload
to `ExternalEvent[]`. Fixture-driven, against `fixtures/challonge-api/`.
_AC:_ `[TEST]` events are dropped; a malformed member is skipped rather than failing the batch; an
unrecognised `state` still produces an event.
_Outstanding:_ the fixture is shaped from the documented v2.1 schema and from the request the previous
site made, not captured from a live response — the endpoint needs a key that only production holds.
Replace it with a real capture the first time anyone holding the key runs the client.

✅ **E23.3 — `core/events/sync-window`** · S · Deps: E23.1 — is a refresh due, and what cutoff does
the claim compare against.
_AC:_ pure — `now` is an argument, never `Date.now()`; a never-synced source is always due.

✅ **E23.4 — `core/events/event-schedule`** · S · Deps: E23.1 — group and sort cached events for
display: live first, then upcoming by start, then recent past.
_AC:_ an event with no `startsAt` sorts last within its group rather than being dropped.

✅ **E23.5 — `external_events` and `external_event_syncs`** · M · Deps: E13.1 — the cache table and
the one-row-per-source sync ledger.
_AC:_ `unique (source, external_id)`; public read policy on the cache, no policy at all on the sync
ledger; a SQL comment explaining that this table is not `tournaments` (E13.6) and why.

✅ **E23.6 — `repos/events`** · M · Deps: E23.5 — `listCachedEvents`, `getSyncState`,
`claimSyncWindow`, `replaceEvents`, `recordSyncResult`.
_AC:_ `claimSyncWindow` is a single conditional update, so two concurrent requests produce one fetch;
`replaceEvents` supersedes wholesale — a since-deleted event leaves the cache.

✅ **E23.7 — Challonge client** · M · Deps: E23.1 — `apps/web/lib/challonge/client.server.ts`,
paginated, timeout-bounded.
_AC:_ returns a discriminated result, never throws; unset credentials are a `not-configured` result,
not an error, so a contributor's local site has a working page and an empty one.
_Outstanding:_ verified against the live endpoint only as far as the auth check. The request shape is
confirmed correct — omitting `Content-Type: application/vnd.api+json` is answered 415, and with it an
invalid key is answered 401 — but no successful 200 payload has been seen from this code.

✅ **E23.8 — `sync-events` service** · M · Deps: E23.3, E23.6, E23.7 — claim the window, fetch, parse,
replace, record. A thin coordinator; the decisions belong to E23.2–E23.4.
_AC:_ a failed fetch still serves the cache and still consumes the window.

✅ **E23.9 — `/events` route and cards** · M · Deps: E23.4, E23.8 — the schedule page, an `EventCard`
that links out, and the header nav item.
_AC:_ every card's primary action is the external event page; the page states how stale the cache is.

✅ **E23.10 — Seed and environment docs** · S · Deps: E23.5 — seed rows across all three states, and
the two Challonge variables documented in `.env.example` as optional.
_AC:_ `pnpm db:reset && pnpm dev` shows a populated `/events` with no credentials set.

✅ **E23.11 — `docs/modules/events.md`** · S · Deps: E23.8 — the cache policy, the request-budget
arithmetic, and how to change the interval.

✅ **E23.12 — melee.gg as a second calendar** · M · Deps: E23.6 — a client and a parser for melee.gg's
tournament listing, so an event run there appears on `/events` and in the home page's next-event tile
alongside the Challonge ones.
_AC:_ a `melee` row in `external_event_syncs` with its own interval and its own budget arithmetic —
the claim is per-source already, so one platform's outage must not spend the other's window; the
parser maps melee's states onto the same three `ExternalEventState` values; `/events` names both
sources in its freshness line rather than saying "Challonge" for a schedule that is no longer only
Challonge.
_Note:_ the prediction held — the client, the parser and one row in `CALENDARS` were the whole story,
plus migration 0015 for the ledger row. Two things the listing payload forced, both recorded in
`parse-melee-events/README.md`: it carries **no scheduled start time**, so `LastPairDateTime` stands in
(within a round of the truth for a finished event, null for one still in registration), and a
cancelled tournament is dropped rather than mapped to `complete`. `MELEE_CLIENT_ID` and
`MELEE_CLIENT_SECRET` are sent as basic auth; a calendar with no credentials is filtered out before
anything is claimed, so setting one platform and not the other is a working configuration.
_Note:_ the inferred `page`/`pageSize` names were wrong — melee ignored them and served its default
of 25. The Swagger names are `variables.page` and `variables.pageSize`, verified live by a page size
of 100 echoing back (E12.11).
✅ **E23.13 — a tournament that ends is handled once** · M · Deps: E23.12 — _AC:_ a refresh that sees an
event reach `complete` — absent from the cache before, or in another state — queues it, once however
many refreshes list it; a runner-agnostic pass claims queued events, calls one hook per event, and marks
it processed so its results are never fetched again; a failure is retried on a later run, up to a limit.
_Note:_ added outside the plan. `0024_event_completions.sql` is the queue, apart from `external_events`
so the wholesale replace cannot erase it; `claim_event_completions` takes a lease with `skip locked`.
`core/events/newly-completed` compares against the cache before `replaceEvents`. The hook,
`onTournamentCompleted`, is a no-op that names what it will coordinate (E12.10, E13.18, E18.12).
`/api/jobs/process-completed-events` runs one pass for `Authorization: Bearer $CRON_SECRET` and refuses
everyone when the secret is unset. `/admin/processing` shows the queue, runs a pass ("Process now"),
and re-queues every finished tournament ("Re-run everything", typed confirmation), backfilling complete
calendar events that were never queued. The re-run clears derived data through `onFullRerun`, a no-op
until E18 writes any, and never the ledger: re-importing an event supersedes it (§26), and the ledger
also holds imports the queue cannot recreate. E18.20 has since filled in both the hook and `onFullRerun`.
⬜ **E23.14 — schedule the completed-events job** · S · Deps: E23.13 — _AC:_ something calls
`/api/jobs/process-completed-events` on a schedule in production, with `CRON_SECRET` set in Vercel and
in the scheduler; the choice of scheduler, and its interval, is recorded here. A GitHub Actions cron
with `workflow_dispatch` is the plan's default (§7).

---

## E24 — Home page

Phase 2. Stream J. The site had a home page from E16.1 — a heading and one post feed — and no story
describing it, so nothing recorded what it was for. It is for three questions: what has the format
announced, what can I enter next, and what won the last event.

Three regions in a grid, each loaded independently: a failure in one renders an error in that tile
and leaves the others alone.

✅ **E24.1 — Grid layout and the page's four regions** · M · Deps: E16.1 — a lead tile two columns
wide, the event tile beside it, the podium spanning both below, and the community feed under that.
_AC:_ the two top tiles are the same height at every width they sit side by side at; the grid
collapses to one column on a phone; each region loads through its own `load()` so one failure does
not blank the page.

✅ **E24.2 — `LatestNewsPanel`** · S · Deps: E24.1 — the newest announcement at full size with its
excerpt, the three behind it as dated lines.
_AC:_ not `PostList` — a feed renders every post at one weight, which is what `/news` wants and the
opposite of what a lead tile wants; the tile is `official` posts only, so nothing appears twice on
a page that also carries the community feed.

✅ **E24.3 — `NextEventPanel`, and the calendar stops being Challonge-shaped** · M · Deps: E23.4,
E24.1 — the one event to turn up to next, with the two after it listed beneath.
_AC:_ `EventSource` is a union rather than a single value; the page-facing read is
`listAllCachedEvents`, so an event from any calendar competes for the tile on its date alone;
`core/events/event-schedule` gains `upcomingEvents`/`nextEvent` and neither looks at `source`; the
platform is a label beside the link, never a heading, a filter or a sort key; the seed carries
melee.gg rows so a one-source regression is visible locally.
_Note:_ the refresh stays per-source and, at the time, Challonge-only. A ledger row is the right to
spend a request against a budget, and inventing melee's before its client existed would have claimed a
budget against nothing — E23.12 added that row, in migration 0015, alongside the client that spends it.

✅ **E24.4 — `EventPodium`** · M · Deps: E24.1 — the top four decks of the most recent event with
results: placement, handle, archetype, colour identity, record, and three cards that say what the
deck is.
_AC:_ `PodiumFinish` renders with every field past the handle missing, because a standings-only
import produces exactly that (ADR 006); no tile links anywhere until there is somewhere to link to.
_Outstanding:_ **the finishers are stand-in data.** `apps/web/lib/podium/sample-podium.ts` holds a
hand-written podium for the seeded `planar-standard-weekly-40`, and the section renders a "Sample
data" badge and says so in prose. The event, the handles, the archetypes and every card named are
real Season II material; the placements and records are invented. E24.5 replaces the loader body.

⬜ **E24.5 — Podium from the results ledger** · M · Deps: E13.7, E13.9, E18.21 — replace
`loadLatestPodium`'s body with the real read: the newest `tournaments` row whose status is
`results_imported` or `verified`, joined to its entries and their decks.
_AC:_ `sample` becomes false and the badge and the note disappear with it; an event whose import
brought standings and no decks still renders a podium, with the deck fields empty; `null` when no
event has results yet, and the section is absent rather than empty.

⬜ **E24.6 — Podium tiles link to the deck** · S · Deps: E24.5, E20.6 — `deckId` is already on the
contract and already null-safe. _AC:_ a finish with no deck stays unlinked rather than linking to a
404, which is the state every standings-only import leaves.

⬜ **E24.7 — Metagame tile** · M · Deps: E19.3, E20.8 — the fourth thing the home page should
answer, once there is a metagame to show: what the field currently looks like. Left unscoped
deliberately — the shape of it depends on what `MetaShare` turns out to read well at tile size.

---

## What's ready now

Every story with no infrastructure dependency is merged: `contracts` plus all eight `core` areas. What
can start today, in rough order of how much it unblocks.

**Unblocks the most**

- **E18.1, E18.2, E18.4, E18.5 — the upload path.** The API path already runs end to end (E18.20):
  content-hash idempotency, staged rows with `raw`, handle resolution (E18.3), supersede
  (`supersedeOtherImports`) and standings (E18.21). What is missing is a file an organizer uploads:
  archiving its bytes (E18.1 still needs a decision on where, and Supabase Storage now has a bucket
  pattern to copy from `post-images`), staging it, and the review queue. E20.15 and E22.12 wait on it.
- **E24.5 — the real podium.** Every ingest now writes its standings (E18.21), so the query has rows
  to read; decks join in once E18.13 stores them. E24.6 follows it.
- **E23.14 — scheduling the completed-events job,** now that `/api/jobs/process-completed-events`
  exists: pick the scheduler, set `CRON_SECRET` in Vercel and in it, and choose an interval. The queue
  makes any interval safe. Until then a melee.gg event is ingested only when an admin presses
  "Process now" at `/admin/processing`.
- **E12.13–E12.14 — Challonge results,** the same shape as melee.gg's. Challonge events are marked
  processed with nothing done until then.
- **E22.9 — `replay-identity.test.ts`,** now that merging exists: two handles, two ratings, one
  merge, one rating, and no `matches` row changed. `merge-players.server.test.ts` already asserts
  the last part.
- **E19 can start.** `repos/stats` is in, so every chart in the epic has something to read — but see
  E19.1 first, which sets the fixture conventions the other thirteen components inherit.
- **E19.13 — `DeckVisualizer`.** E20.29's text list already links each card to Scryfall and shows it on
  hover; what E19.13 adds is mana cost per line, the Spells | Lands | Sideboard grouping, and a
  component that takes shaped lines as props.
- **E20.4, E20.26, E22.11 — the card dataset's other readers,** now that E4.7 loads it: `/cards`, the
  card component in posts, and the integrity test.
- **E17.4 — `<Chart />`,** the last thing between E17 and a finished epic. It waits on E19.

**Needs nothing but a sitting**

- The _Outstanding:_ lines on E17.2 and E17.3: set and card names on `/rules`. The banlist shows an
  oracle id, and since E20.33 lets an admin ban a card by name, the first real ban will show as a uuid.
- E20.34 — rate or unrate a tournament from `/admin`.
- E4.5–E4.6 — the dataset build in CI, and its size ceiling (10 MB gives ~4x headroom).
- E21.1 — the Season II decklist backfill. `archetype-map-html` reads the map, so what is left is
  running it over the real `frontend/public/InteractiveArchetypeMap*.html` in the parent repo —
  417 decklists, against the 3 in `fixtures/archetype-map/`.
- E22.4, E22.6, E22.7, E15.4 — issue templates, the fourteen ADRs (`docs/adr/` holds only its README),
  linking the module-doc index, and finishing `CONTRIBUTING.md`.

**Waiting on a person, not on code**

E12.4, E12.5, E12.6, E16.7, E22.2, E22.3, E22.8 — each carries a _Blocked:_ line naming exactly what it
needs.

**Where things stand**

- **Results and ratings.** A finished melee.gg event is fetched, ingested with its standings and, if it
  is a Monthly, rated (E18.20, E18.21). The ladder is the current season's (E18.12), seasons are opened
  at `/admin/seasons` (E20.35), and handles are merged, and unmerged, at `/admin/players` (E20.16).
- **Events.** E23 is complete bar E23.14: `/events` and the home page fetch Challonge and melee.gg
  independently, each against its own ledger row, and render from the seed anywhere the credentials
  are unset. See [`docs/modules/events.md`](docs/modules/events.md).
- **Posts.** News and community posts are written in one editor (E20.2, E20.27) with image, decklist
  and tournament components (E20.24, E20.25, E20.36), and export whole to Reddit and Discord. See
  [`docs/modules/content.md`](docs/modules/content.md).
- **Decks.** Members import, edit, version and remove their decks (E20.28–E20.31); admins edit the
  format at `/admin/formats` (E20.33).
- **Auth and access.** E14 and E16 are in bar E16.7: four ways to sign in, `requireViewer` /
  `requireRole`, a dashboard every member can open, and `/admin` for admins. A new gated page calls
  `requireRole` and adds one entry to `lib/auth/dashboard-sections.ts` or `admin-sections.ts`.
  Production still needs **real SMTP** — two of the four ways in are an email, and so is every
  password reset. See [`docs/modules/auth.md`](docs/modules/auth.md).
- **The home page shows one thing it does not have.** The top-four-decks section runs on a
  hand-written podium (E24.4's _Outstanding:_ line) and says so on the page. E24.5 is the swap.

## Phase 0 merge order

The ordering originally suggested for the first ten merges, kept for reference:

1. ✅ E1.1 workspace skeleton
2. ✅ E1.4 dependency-cruiser rules
3. ✅ E1.6 CI pipeline
4. ✅ E2.1–E2.8 contracts
5. ✅ E22.5 PR template
6. ✅ E3.1 decklist fixture corpus
7. ✅ E4.1 `data/sets.json`
8. ✅ E4.3 + E4.4 dataset build
9. ✅ E13.1–E13.2 first migrations
10. 🚧 E16.1 scaffold ✅ · E16.7 deploy ⬜

The eight parallel streams from §18 are open; the backlog has stopped being a queue.

## Progress

| Epic | Stories | Done | Epic | Stories | Done |
| ---- | ------- | ---- | ---- | ------- | ---- |
| E1   | 9       | 9    | E12  | 14      | 9    |
| E2   | 9       | 9    | E13  | 23      | 23   |
| E3   | 7       | 7    | E14  | 7       | 7    |
| E4   | 7       | 5    | E15  | 5       | 1    |
| E5   | 6       | 6    | E16  | 14      | 13   |
| E6   | 8       | 8    | E17  | 13      | 12   |
| E7   | 5       | 5    | E18  | 21      | 5    |
| E8   | 7       | 7    | E19  | 14      | 0    |
| E9   | 9       | 9    | E20  | 36      | 21   |
| E10  | 3       | 3    | E21  | 6       | 0    |
| E11  | 6       | 6    | E22  | 12      | 3    |
|      |         |      | E23  | 14      | 13   |
|      |         |      | E24  | 7       | 4    |

**185 of 262 stories done across 24 epics.**
