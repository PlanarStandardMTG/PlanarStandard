# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A community site for the Magic: The Gathering format **Planar Standard**: metagame analytics, an Elo
leaderboard, decklist import/validation, and news and community posts.

Two documents govern the work and outrank any summary here:

- **`planar-standard-master-plan.md`** — the design. Read the section a task touches before writing code.
  §5 dependency rule · §6 what a module is · §7–11 the module index (every module, one line each) ·
  §12–16 the full schema · §17 local dev · §19 definition of done · §21 ADRs · §22 testing · Part VI
  feature specs · Part VIII risks · Part IX settled open questions.
- **`backlog.md`** — the work, as epics **E1–E22**, each story sized to one sitting with acceptance
  criteria and hard dependencies. Branch names and PR titles use the story ID (e.g. `E5.2`).

### Keeping the backlog current

`backlog.md` is the progress record — every story carries a status marker and every epic a tally. Do not
restate progress here; this file goes stale, that one is maintained.

- **A story's marker flips in the same commit as its work.** A commit that implements `E5.4` and leaves
  `E5.4` on ⬜ is an incomplete commit, the same way a missing test is.
- Update the epic's count in the **Epic map** table and in the **Progress** table at the bottom. They are
  small and hand-maintained on purpose: a wrong tally is visible, a missing one is not.
- Markers are ✅ done · 🚧 in progress · ⛔ blocked · ⬜ not started. A ⛔ gets a `*Blocked:*` line naming
  **what is needed**, not who owes it.
- A story that ships with one acceptance criterion genuinely deferred stays ✅ and gets an
  `*Outstanding:*` line naming the deferred check. Do not leave the marker ambiguous instead.
- A story that shipped in full but not the way the line described gets a `*Note:*` line saying what
  was done differently and why. That is not the same as an `*Outstanding:*`, and using one for the
  other hides a real gap or invents one.
- Adding or splitting a story is fine. **Renumbering an existing one is not** — IDs are already in branch
  names, commit messages, and PR titles.
- Keep the **What's ready now** section honest when a merge unblocks something. It is the section a new
  contributor reads first.

## Commands

```bash
pnpm install                      # Node >= 24, pnpm 12
pnpm lint                         # eslint . --max-warnings 0 (one root config, no per-package drift)
pnpm format                       # prettier --write .
pnpm depcruise                    # dependency boundary enforcement — see below
pnpm test                         # pnpm -r run test
pnpm build                        # pnpm -r run build (tsc project references)
```

Per-package and single-test (`--filter core` and `--filter @ps/core` both match):

```bash
pnpm --filter core test                       # zero env vars, no Docker
pnpm --filter core test -- path/to/file.test.ts
pnpm --filter core test -- -t "test name"     # vitest run; per-package, no root vitest config
```

Full stack (needs Docker):

```bash
pnpm dev:db                       # the usual one: start + reset + .env.local + dev, from anywhere
pnpm db:start / pnpm db:stop      # supabase start/stop (local)
pnpm db:reset                     # migrations + seed
pnpm dev                          # --filter web dev — http://localhost:3000, keeps local data
```

`supabase/` is gitignored, so `pnpm db:setup` (run automatically by `db:start` and `db:reset`)
materialises `config.toml` and a `migrations/` symlink from `packages/db`, which stays the single
source of truth. Seeds are read in place from `packages/db/seed/*.sql`.

`apps/web` needs `.env.local`; `dev:db` copies it from `apps/web/.env.example`, which holds the
Supabase CLI's published local demo keys. Under `next dev` the header's **Dev** dropdown signs in as
any seeded account, reader through admin (E16.13).

CI (`.github/workflows/ci.yml`) runs `lint`, `depcruise`, `guard:server-only`, `test`, `build` in that
order. Match it locally before pushing.

```bash
pnpm guard:server-only            # E1.7 — asserts no 'use client' module can reach the service-role key
pnpm content:sync                 # rewrites the generated regions of content/pages/*.mdx from docs/modules/
pnpm new:module core/metrics/foo  # scaffolds index.ts, index.test.ts, README.md; the test starts red
```

## Architecture: dependencies point left, always

```
contracts <- core <- adapters
    ^        ^ ^         ^
    │        │ └ cards   │
    └──── db ─┴──────────┘
              ^
         web, jobs
```

Machine-enforced by `.dependency-cruiser.cjs`; a violating PR fails before review. If a boundary feels
wrong, the design is wrong — don't work around it.

- **`packages/contracts`** (`@ps/contracts`) — types only, **zero runtime dependencies**, imports
  nothing. That is what lets both sides of an interface be built in parallel. Changing an exported type
  is a breaking change and must be called out in the PR description.
- **`packages/core`** (`@ps/core`) — pure functions, all testable with no infrastructure. Must never
  import `db`, `next`, `react`, or `@supabase/*`, and never does file I/O. **If a function needs data, it
  takes it as an argument** — the card index is passed in; loading it is `packages/cards`' job. Areas:
  `decklist`, `legality`, `metrics`, `similarity`, `elo`, `identity`, `stats`, `reddit`, `results`,
  `content`, `events`, `auth` (§8).
- **`packages/adapters`** (`@ps/adapters`) — one file per results source, all implementing
  `ResultsAdapter`: `{ id, detect(RawInput), parse(RawInput), capabilities }`. Pure: `RawInput` in,
  `ParsedEvent` out. Depends on contracts + core only.
- **`packages/db`** (`@ps/db`) — schema, numbered forward-only `migrations/`, `seed/`, and one
  `repos/<aggregate>` per table group. Depends on contracts only. Repositories expose **narrow,
  intention-revealing functions** (`listRatedTournamentsBySeason`, not `query`); no SQL string escapes
  the module.
- **`packages/cards`** (`@ps/cards`) — **the only module in `packages/` that reads a file.** Loads
  `data/cards/` once per process and hands it to `core/legality/build-card-index`; it does nothing
  else. It exists because `core` does no file I/O and `web` cannot import `jobs`.
- **`apps/web`** — Next.js (App Router, Tailwind v4, React 19). Feature slices own their routes,
  components, and hooks and **never import from each other**; shared UI goes to `components/ui`.
  Services are thin coordinators: load via repos, call pure core functions, write via repos.
  **Business logic in a service is in the wrong place** — it belongs in `core`. See
  `apps/web/README.md` for the two layout rules that are easy to get wrong (`force-dynamic` on
  content pages, and why feed indexes live in an `(index)` route group).
- **`apps/jobs`** — scheduled scripts run by GitHub Actions. Never imported by `apps/web`.

### What a module is (§6)

One directory, one responsibility, one test file. If you can't describe it in a sentence without "and",
split it. Every module ships `index.ts` (usually under 60 lines), `index.test.ts`, and a 3–10 line
`README.md` covering purpose, inputs, outputs, gotchas.

## Domain rules that are easy to get wrong

- **Cards are not in Postgres.** The dataset lives in `data/cards/` as generated JSON (`oracle.json`,
  `printings.json`, `meta.json`), built from Scryfall bulk data by `apps/jobs/build-card-data.ts`. So
  `oracle_id` columns carry **no foreign key** — integrity comes from `dataset-integrity.test.ts`
  instead. Never hand-edit `data/cards/`. Card filtering happens in-app against the loaded index, not in
  SQL. Streaming prune only: never `JSON.parse` the whole bulk file.
- **`data/sets.json` ≠ `format_legal_sets`.** The first is the _fetch scope_ — what the committed dataset
  contains, generous by design, changed by PR. The second is the _legal pool per format version_,
  admin-edited in the database so special events can define custom pools without a deploy.
- **Format authority is data, not code.** A B&R announcement must never require a pull request. Bans,
  exceptions, legal sets, and archetype vocabulary are admin-edited rows.
- **Legality = the oracle card has any printing in a legal set; any printing may then be played**
  (ADR 007). The parser resolves cards by _name_, never by printing — `(PLST) WOE-273` on a decklist line
  is kept as provenance and never has to resolve. Relatedly, `set-attribution` attributes a card to its
  **legal** set, not its printed one: `Llanowar Elves (M19)` counts as FDN.
- **The ledger records handles, not people** (ADR 003). Matches reference `player_identities`, never
  `players`; identity is resolved at read time during a replay. Merging two handles must produce one
  merged rating **without mutating any row in `matches`**.
- **Full recompute, never incremental** (ADR 004). Every statistic is derived and recomputable; no
  statistic is ever uploaded or hand-edited.
- **Capability gating.** Elo consumes `matches` only. A standings-only import is recorded for metagame
  purposes and marks the tournament unrated. **Never infer pairings from placements** — it silently
  corrupts every rating downstream.
- **Re-importing an event supersedes wholesale** — replacement, never a merge. Raw bytes are archived
  permanently and `raw jsonb` is retained per staged row so parser fixes re-run without the original file.
- **Any user-visible rate or percentage goes through `suppress-small-n` and shows `n`.** This is a
  merge-blocking checklist item, not a style preference.
- **An info page is repo MDX; a post is a database row** (§25). `content/pages/*.mdx` describes how
  the site or format works and is reviewed before it changes; a post is something an ambassador
  publishes this week without a PR. The split rule decides which, and it is not the same question as
  a post's `kind`.
- **A page may only contain Markdown and the components its frontmatter declares.** MDX executes, so
  `remarkInfoPageWhitelist` refuses raw JSX, brace expressions, and `import` at compile time. MDX's
  `components` prop cannot do this — it only intercepts Markdown-derived elements, so a literal
  `<script>` compiles straight past it.
- **`/methodology` and `/ratings-explained` are generated, not written.** Their bodies come from
  `docs/modules/metrics.md` and `ratings.md`, between the `publish:start` / `publish:end` markers. Edit
  the doc, run `pnpm content:sync`, commit both — a test fails when they disagree (§19).
- **A post's `kind` is who is speaking, not how far through review it is.** `official` is the format —
  B&R notices, season openings, event recaps, at `/news`; `community` is a member under their own
  byline, at `/community`. That is a different axis from `status` (draft → review → published →
  archived) and from the §25 split rule, which decides repo-MDX versus database-post in the first
  place. A slug is unique across both kinds, so each post has exactly one canonical URL and the other
  kind's prefix 404s.
- **Seeded RNG in `force-layout`** — the archetype map must be reproducible run to run.
- **Only `mana-font` and `keyrune`** from the MTG npm ecosystem (ADR 014).

## Conventions

- **Tests run with zero credentials** for `core`, `contracts`, and `adapters` — an explicit CI guarantee
  and the project's main onboarding promise. Only `db`, service, and e2e tests may need local Supabase.
- **Fixtures** (`fixtures/<source>/`) are real exports committed verbatim, with expected outputs as
  sibling `.expected.json`. Parser and adapter work is fixture-driven; a new edge case is a fixture plus
  a branch.
- **Changing a metric definition also changes `content/pages/methodology.mdx`** — definitions are
  published verbatim next to the code.
- **Decisions are listed in §21 of the plan** (ADRs 001–014). `docs/adr/` is meant to hold one file
  each but holds only its README until E22.6; until then §21 and the plan sections it points to are the
  record. Check there before reopening a settled question.
- TypeScript is strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; project
  references mean a type error in `contracts` breaks every dependent build.
- `SUPABASE_SERVICE_ROLE_KEY` must be unreachable from any client bundle (guarded in CI by E1.7).
- `supabase/` is gitignored — local Supabase state is not committed.
- No new dependency without a line in the PR description explaining why.

## Comments

Keep them brief and let the code explain itself. Name things well instead of narrating what a line does.

Comment the things code cannot say: a non-obvious _why_, a real-world quirk the logic exists to survive
(`｜` rewritten to `_` by the OS, melee's 60-day export window), or a link to the ADR or plan section a
choice comes from.

Do not write defensive comments justifying a decision that only looks arbitrary because the file is read
without its context. The dependency rule, the missing foreign keys, handles-not-people — these are
documented in the plan and the ADRs. A pointer is fine; a paragraph re-arguing the case is not.
