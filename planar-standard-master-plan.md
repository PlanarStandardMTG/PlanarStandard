# Planar Standard Hub — Master Plan

**Status:** final planning document.
**Audience:** contributors. This is the document a new person reads before their first PR.
**Organising principle:** every unit of work should be small enough that one person can finish it in a sitting, and isolated enough that finishing it doesn't block or conflict with anyone else.

---

## Part I — What we're building

### 1. The product

A community site for the Magic: The Gathering format **Planar Standard**.

| Feature                | What it does                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Metagame analytics** | Live charts and an interactive archetype map, replacing a hand-maintained spreadsheet driven by simple imported data |
| **Leaderboard**        | Elo ratings computed from tournament results                                                                         |
| **Decklists**          | Import, validate, visualize                                                                                          |
| **Articles**           | Ambassadors write metagame recaps, one-click copy to Reddit                                                          |
| **Info pages**         | Rules, FAQ, methodology — versioned in the repo                                                                      |

### 2. The three data streams

They are independent on purpose. Each can be built, broken, and fixed without touching the others.

```
RESULTS  ──► Melee.gg data ──► matches ledger ──► Elo replay ──► leaderboard
DECKS    ──► ~ decklists in Google Drive? ──► deck_cards ──► metrics/stats ──► charts, map, card scores
CONTENT  ──► MDX pages (repo) + posts (database) ──► articles, rules, methodology
```

**Optionally:** They meet in exactly one optional place: `tournament_entries` links a player to the deck they piloted, which yields the matchup matrix. If that link is missing, everything else still works.

### 3. Rules that everything follows

1. **Raw in, derived out.** Decklists and match results are the only inputs. Every statistic — curves, colour splits, card scores, similarity edges, ratings — is computed and fully recomputable. No statistic is ever uploaded or hand-edited.
2. **The ledger records handles, not people.** A match says `"c0d33" beat "Brayzon" 2–1`. Who those are is a separate, mutable mapping resolved at replay time.
3. **Sources are pluggable.** Anything that can produce results implements one adapter interface. No platform is special.

---

## Part II — Repository structure

### 4. Workspace layout

A pnpm workspace. The split exists so that **the interesting logic has zero infrastructure dependencies** — a contributor can clone, `pnpm install`, `pnpm test` in `packages/core`, and be productive without a Supabase account, a Discord app, or any environment variable.

```
planar-standard/
├── packages/
│   ├── contracts/     types only. zero runtime dependencies.
│   ├── core/          pure functions. depends on contracts ONLY.
│   ├── adapters/      source parsers. depends on contracts + core.
│   └── db/            schema, migrations, repositories. depends on contracts.
├── apps/
│   ├── web/           Next.js. depends on everything.
│   └── jobs/          scheduled scripts (card-data build, backfills). GitHub Actions.
├── data/
│   ├── sets.json      which sets to fetch. PR-reviewed. drives the build below.
│   └── cards/         GENERATED — do not hand-edit. see §14.1
│       ├── oracle.json
│       ├── printings.json
│       └── meta.json
├── content/pages/     MDX info pages
├── fixtures/          shared test fixtures (real exports, real decklists)
└── docs/
    ├── adr/           architecture decision records
    └── modules/       one page per module
```

### 5. Dependency rule

```
contracts ◄── core ◄── adapters
    ▲         ▲ ▲         ▲
    │         │ └─ cards   │
    └──── db ─┴───────────┘
              ▲
          web, jobs
```

**Dependencies point left only. No cycles. Ever.** Enforced in CI by `dependency-cruiser`; a violating PR fails before review.

The three consequences that matter:

- `packages/core` must never import from `db`, `next`, `react`, or `@supabase/*`. If a function needs data, it takes it as an argument.
- `packages/contracts` has no runtime dependencies at all, so both sides of any interface can be built in parallel by different people.
- `packages/cards` is the only module in `packages/` that reads a file. Card data is a repo artifact rather than a table (§14.1), so something has to load it — and it can be neither `core`, which does no file I/O, nor `jobs`, which `web` may not import (E4.7).

### 6. What "a module" means here

A module is **one directory, one responsibility, one test file, one owner**. If you can't describe it in a single sentence without "and", split it.

Every module ships with:

```
packages/core/metrics/mana-curve/
├── index.ts           the function. usually under 60 lines.
├── index.test.ts      unit tests
└── README.md          3–10 lines: what it does, inputs, outputs, gotchas
```

---

## Part III — The module index

Every module in the system. **Pure** modules need no infrastructure to develop or test — those are the best entry points for new contributors.

### 7. `packages/contracts` — types only

| Module     | Exports                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `cards`    | `OracleCard`, `CardPrinting`, `CardIndex`, `OracleId`, `Rarity`, `Layout`                  |
| `decks`    | `ParsedDeck`, `ParsedLine`, `ResolvedDeck`, `Board`                                        |
| `format`   | `FormatVersion`, `FormatRules`, `LegalityVerdict`, `Issue`                                 |
| `results`  | `RawInput`, `ParsedEvent`, `ParsedMatch`, `ParsedStanding`, `Capability`, `ResultsAdapter` |
| `identity` | `Handle`, `IdentityRef`, `MergeSuggestion`, `Signal`, `Exclusion`                          |
| `ratings`  | `RatingConfig`, `RatingEvent`, `PlayerRating`, `LedgerMatch`                               |
| `metrics`  | `DeckMetrics`, `CardStats`, `ArchetypeStats`, `SimilarityEdge`                             |
| `content`  | `Post`, `PostStatus`, `InfoPageFrontmatter`                                                |

Write these first. Once they exist, every other package can be built in parallel.

### 8. `packages/core` — pure logic

**All pure. All testable with `pnpm test` and nothing else.**

#### 8.1 `core/decklist` — text → structured deck

| Module           | One-line job                                                             |
| ---------------- | ------------------------------------------------------------------------ |
| `tokenize-line`  | `"4 Bolt (FDN) 192 *F*"` → `{qty, name, set, collector, foil}`           |
| `detect-board`   | Is this line a `SIDEBOARD:` / `Sideboard` / `SB:` / blank-line boundary? |
| `normalize-name` | NFKC, case, punctuation, `//` handling, MDFC front/back faces            |
| `parse-decklist` | Composes the above over a document → `ParsedDeck`                        |
| `parse-filename` | `Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL` → structured metadata    |

Real cases from existing data that each needs to survive: missing set codes, `*F*` markers, promo sets (`PSOS`), alphanumeric collectors (`25p`, `WOE-273`), split cards (`Sanar, Unfinished Genius / Wild Idea`), fullwidth `｜` and `＞`, and filenames where the OS rewrote `｜` to `_`.

#### 8.2 `core/legality` — deck + rules → verdict

| Module              | One-line job                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `build-card-index`  | Dataset arrays → lookup maps by oracle id, normalized name, and set. Pure: takes the parsed dataset as an argument |
| `resolve-card-name` | Parsed decklist name → `oracle_id`, with fuzzy "did you mean" candidates                                           |
| `resolve-format`    | Format version rows → a flat `FormatRules` object                                                                  |
| `check-card`        | One card against the pool, banlist, and exceptions                                                                 |
| `check-deck`        | Sizes, copy limits, basic-land exemption; composes `check-card`                                                    |

**The format rule, confirmed from real data:** a card is legal if its oracle card has _any_ printing in a legal set. Any printing may then be played. (EG: Season II tracks six sets (SOS, ECL, EOE, TDM, DFT, FDN) while printings come from FIN, ONE, M19, PLST, and promos.)

#### 8.3 `core/metrics` — deck → numbers

| Module                 | One-line job                                                |
| ---------------------- | ----------------------------------------------------------- |
| `mana-curve`           | MV histogram, buckets 1–6 and 7+, non-lands only            |
| `color-counts`         | Counts per colour of identity                               |
| `type-counts`          | Land/Creature/Instant/…                                     |
| `set-attribution`      | Attributes a card to its **legal** set, not its printed set |
| `rarity-counts`        | C/U/R/MR                                                    |
| `average-mv`           | Incl. lands, excl. lands, sideboard                         |
| `compute-deck-metrics` | Composes all of the above                                   |

Each definition is pinned in `docs/modules/metrics.md` and published verbatim at `/methodology`. `set-attribution` is the subtle one — `Llanowar Elves (M19)` counts as FDN.

#### 8.4 `core/similarity` — decks → graph

| Module                   | One-line job                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| `deck-vector`            | `ResolvedDeck` → card→quantity map, basics excluded               |
| `weighted-jaccard`       | `Σ min / Σ max` over two vectors                                  |
| `build-similarity-graph` | All pairs above threshold → edge list                             |
| `force-layout`           | Edge list → `{x, y}` per node, **seeded RNG** for reproducibility |

Basics excluded, non-basic lands included, maindeck only, default threshold 0.5. At 98 nodes that reproduces the ~763 edges in the existing map.

#### 8.5 `core/elo` — matches → ratings

| Module           | One-line job                                               |
| ---------------- | ---------------------------------------------------------- |
| `expected-score` | `1 / (1 + 10^((Rb−Ra)/400))`                               |
| `pick-k`         | Provisional / standard / elite, times tournament weight    |
| `apply-match`    | Both players updated simultaneously from pre-match ratings |
| `replay`         | Ordered match stream → full rating history                 |

`replay` takes matches **already resolved to player IDs** as an argument. It does no I/O, so its test is a fixture of matches and an expected rating table.

#### 8.6 `core/identity` — handles → suggested merges

| Module                     | One-line job                                            |
| -------------------------- | ------------------------------------------------------- |
| `normalize-handle`         | Lowercase, strip non-alphanumerics                      |
| `signals/parenthetical`    | `Zaunus13 (LikoRS)` → explicit pairing, confidence 0.95 |
| `signals/deck-fingerprint` | Same 75 under two handles across events → 0.90          |
| `signals/trigram`          | String similarity → 0.60                                |
| `signals/containment`      | `Liko` ⊂ `LikoRS` → 0.55                                |
| `signals/temporal`         | A's last event precedes B's first → 0.30                |
| `score-candidates`         | Combines signals, applies exclusions, ranks             |
| `co-appearance-exclusions` | Two handles in one event ⇒ **never the same person**    |

`signals/` is the best contribution surface in the repo: each file is one scoring function with an obvious test, and adding one is a self-contained PR.

#### 8.7 `core/stats` — presentation-safe aggregation

| Module             | One-line job                                      |
| ------------------ | ------------------------------------------------- |
| `wilson`           | 95% confidence interval on a proportion           |
| `aggregate-by`     | Group-and-sum helpers used by every stats builder |
| `suppress-small-n` | Given a rate and n, decide show / grey / hide     |

`suppress-small-n` is imported by every chart component. Sample-size discipline is enforced in code, not remembered per page.

#### 8.8 `core/reddit` — Markdown → Reddit-safe Markdown

| Module                    | One-line job                                        |
| ------------------------- | --------------------------------------------------- |
| `tables-to-lists`         | Reddit renders tables inconsistently                |
| `strip-html`              | Reddit drops raw HTML                               |
| `absolutize-links`        | `](/cards/…` → `](https://…/cards/…`                |
| `images-to-links`         | Self-posts can't inline images                      |
| `expand-chart-shortcodes` | `:::chart{…}` → link + PNG reference                |
| `to-reddit-markdown`      | Pipeline over the above, appends canonical backlink |

Five tiny transforms and a pipeline. Each is a two-minute PR with a before/after fixture.

#### 8.9 `packages/cards` — the loader that `core` may not be

`core` takes the card index as an argument and never reads a file, which is what makes every module above testable with no infrastructure. Something still has to read `data/cards/` off disk, and it cannot be `apps/jobs` either, because `apps/web` may not import it.

| Module    | Does                                                                     |
| --------- | ------------------------------------------------------------------------ |
| `dataset` | `loadCardDataset` and `loadCardIndex` — parse once per process, memoized |

That is the whole package, and it is the only module in `packages/` that touches the filesystem (E4.7). It depends on contracts and core; `web` and `jobs` depend on it.

### 9. `packages/adapters` — sources → canonical events

One file per source. All implement `ResultsAdapter` from contracts; all are pure (`RawInput` in, `ParsedEvent` out).

| Adapter              | Capabilities                         | Priority                        |
| -------------------- | ------------------------------------ | ------------------------------- |
| `generic-csv`        | matches or standings, manual mapping | **first** — the permanent floor |
| `manual-entry`       | matches                              | **first** — always available    |
| `melee-csv`          | matches, standings, roster           | second                          |
| `challonge-csv`      | matches, standings, roster           | second                          |
| `legacy-xlsx`        | standings                            | one-time backfill               |
| `archetype-map-html` | decklists                            | one-time backfill               |

**Adding an adapter is the ideal first contribution:** drop a real export into `fixtures/`, write `detect` and `parse`, write the expected `ParsedEvent` JSON, done. No database, no UI, no coordination.

**Capability gating.** Elo consumes `matches` only. A standings-only import records the event for metagame purposes and marks the tournament unrated. Pairings are never inferred from placements — that silently corrupts every rating downstream.

### 10. `packages/db` — schema and repositories

One repository module per aggregate. Each exposes narrow, intention-revealing functions — never a generic query builder — so callers can't drift into ad-hoc SQL.

| Module              | Owns tables                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `repos/format`      | `format_versions`, `format_legal_sets`, `format_card_rules`, `format_constraints`           |
| `repos/decks`       | `decks`, `deck_cards`, `deck_metrics`                                                       |
| `repos/tournaments` | `tournaments`, `tournament_entries`, `seasons`                                              |
| `repos/results`     | `result_imports`, `staged_matches`, `matches`, `match_corrections`                          |
| `repos/identity`    | `players`, `player_identities`, `identity_exclusions`, `merge_suggestions`, `player_merges` |
| `repos/ratings`     | `rating_events`, `player_ratings`, `rating_config`, `rating_runs`                           |
| `repos/stats`       | `card_stats`, `archetype_stats`, `deck_similarity`, `deck_map_layout`, `matchup_stats`      |
| `repos/content`     | `posts`, `post_revisions`                                                                   |
| `repos/archetypes`  | `archetypes`, `archetype_aliases`                                                           |

Plus `migrations/` (numbered, forward-only) and `seed/` (§17).

### 11. `apps/web` — services and UI

#### 11.1 Services — the only impure orchestration

| Service             | Job                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `import-results`    | adapter → stage → resolve → review → commit                                                           |
| `import-decklists`  | folder drop / paste → parse → resolve → commit                                                        |
| `recompute-ratings` | full Elo replay, resolving identities at read time                                                    |
| `recompute-metrics` | deck metrics, card stats, archetype stats, similarity, layout                                         |
| `merge-players`     | repoint identities, recompute, audit                                                                  |
| `build-card-data`   | Runs in `apps/jobs`, not the web app. Fetches Scryfall bulk, prunes, commits `data/cards/`. See §14.1 |
| `publish-post`      | status transition + Discord notify                                                                    |
| `notify-discord`    | webhook wrapper                                                                                       |

Each service is a thin coordinator: load data via repos, call pure core functions, write results via repos. **If a service contains business logic, that logic is in the wrong place** — it belongs in `core`.

#### 11.2 Feature slices

Each slice owns its routes, components, and hooks. Slices don't import from each other; shared UI goes to `components/ui`.

| Slice            | Routes                                                |
| ---------------- | ----------------------------------------------------- |
| `auth`           | login, callback                                       |
| `content`        | `/community/*`, MDX `/(info)/[...slug]`               |
| `cards`          | `/cards`, `/cards/[oracleId]`                         |
| `decks`          | `/decks/[id]`, submission                             |
| `meta`           | `/meta`, `/meta/map`, `/meta/cards`, `/meta/matchups` |
| `leaderboard`    | `/leaderboard`, `/players/[slug]`                     |
| `tournaments`    | `/tournaments/[slug]`, import dashboard               |
| `identity-admin` | `/dashboard/identities`, merge grid, CSV round-trip   |
| `format-admin`   | `/dashboard/format`                                   |

#### 11.3 Chart components

One component per visual, each taking already-shaped data as props — so they render in Storybook from a fixture with no database.

`MetaShare` · `ArchetypePerformance` · `ManaCurve` · `ColorDistribution` · `SetAdoption` · `CardScoreTable` · `CardInclusionSparkline` · `ArchetypeMap` · `MatchupMatrix` · `RatingHistory` · `DeckVisualizer`

All rate-displaying components import `suppress-small-n` and render Wilson intervals. See Part VI for the full analytics spec.

---

## Part IV — Schema

Grouped by owning module. Full DDL lives in `packages/db/migrations/`; this is the shape.

Sections below are ordered by module, not by dependency — several forward-reference tables defined later. Migrations create them in this order: `profiles` → `cards`, `card_printings` → `format_*` → `archetypes` → `seasons` → `players`, `player_identities` → `tournaments` → `decks`, `deck_cards` → `result_imports`, `staged_matches`, `matches` → `tournament_entries`, `identity_exclusions` → derived tables → views.

### 12. Identity and ratings

```sql
create type player_visibility as enum ('public','hidden');

create table players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text unique not null,
  profile_id uuid unique references profiles(id) on delete set null,
  visibility player_visibility not null default 'public',
  merged_into uuid references players(id),
  created_at timestamptz not null default now()
);

create type identity_platform as enum ('discord','challonge','melee','mtgo','arena','manual');
create type identity_source   as enum ('import_inferred','admin_assigned','discord_oauth','organizer_entered');

create table player_identities (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  platform identity_platform not null,
  handle text not null,
  normalized text generated always as (lower(regexp_replace(handle,'[^a-zA-Z0-9]','','g'))) stored,
  source identity_source not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (platform, normalized)
);
create index player_identities_player_idx on player_identities (player_id);

create table identity_exclusions (
  identity_a uuid not null references player_identities(id) on delete cascade,
  identity_b uuid not null references player_identities(id) on delete cascade,
  reason text not null,                       -- 'co_appearance' | 'admin_dismissed'
  tournament_id uuid references tournaments(id),
  primary key (identity_a, identity_b),
  check (identity_a < identity_b)
);

create table merge_suggestions (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references players(id) on delete cascade,
  player_b uuid not null references players(id) on delete cascade,
  confidence numeric not null,
  evidence jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','merged','dismissed','stale')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  unique (player_a, player_b)
);

create table player_merges (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null references players(id),
  loser_id  uuid not null references players(id),
  reason text, moved jsonb not null,
  merged_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

```sql
create table rating_config (
  id int primary key default 1 check (id = 1),
  initial_rating int not null default 1500,
  k_provisional int not null default 40,
  k_standard    int not null default 24,
  k_elite       int not null default 16,
  provisional_matches int not null default 15,
  elite_threshold int not null default 2100,
  min_matches_for_leaderboard int not null default 10,
  inactive_after_days int not null default 120,
  count_byes boolean not null default false,
  count_elimination_rounds boolean not null default true
);

create table rating_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  opponent_id uuid references players(id),
  event_date date not null,
  rating_before numeric not null, rating_after numeric not null,
  expected_score numeric not null, actual_score numeric not null,
  k_factor numeric not null, match_number int not null,
  unique (player_id, match_id)
);

create table player_ratings (
  player_id uuid primary key references players(id) on delete cascade,
  rating numeric not null, peak_rating numeric not null,
  matches_played int not null default 0,
  wins int not null default 0, losses int not null default 0, draws int not null default 0,
  tournaments_played int not null default 0,
  last_played date,
  is_provisional boolean not null default true,
  is_active boolean not null default true
);

create table rating_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,
  match_count int, player_count int, duration_ms int,
  anomalies jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index rating_events_player_date_idx on rating_events (player_id, event_date);

create view leaderboard as
select p.id, p.slug, p.display_name,
       r.rating, r.peak_rating, r.matches_played,
       r.wins, r.losses, r.draws, r.tournaments_played,
       r.last_played, r.is_active
from player_ratings r
  join players p on p.id = r.player_id
where p.visibility = 'public'
  and p.merged_into is null
  and not r.is_provisional
  and r.matches_played >= (select min_matches_for_leaderboard from rating_config where id = 1);
```

### 13. Results ledger

```sql
create type tournament_status as enum ('draft','awaiting_results','results_imported','verified','archived');
create type import_status     as enum ('uploaded','parsed','resolved','needs_review','committed','failed','superseded');
create type match_result      as enum ('p1_win','p2_win','draw','bye','double_loss');

create table seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null, ordinal int not null unique,
  starts_on date not null, ends_on date,
  format_version_id uuid references format_versions(id),
  is_current boolean not null default false
);
create unique index seasons_one_current on seasons (is_current) where is_current;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  event_date date not null,
  season_id uuid references seasons(id),
  format_version_id uuid references format_versions(id),
  platform text, external_url text,
  structure text, rounds int, player_count int,
  weight numeric not null default 1.0,
  is_rated boolean not null default false,
  status tournament_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table result_imports (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  adapter_id text not null, source_platform text,
  file_path text, file_name text, content_hash text not null,
  capabilities text[] not null default '{}',
  column_mapping jsonb, status import_status not null default 'uploaded',
  row_count int, stats jsonb, errors jsonb,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(), committed_at timestamptz,
  unique (tournament_id, content_hash)
);

create table staged_matches (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references result_imports(id) on delete cascade,
  row_index int not null, raw jsonb not null,
  round int, table_number int,
  p1_handle text, p2_handle text,
  p1_games int, p2_games int, game_draws int,
  result text, is_elimination boolean default false,
  p1_identity_id uuid references player_identities(id),
  p2_identity_id uuid references player_identities(id),
  p1_method text, p2_method text,
  p1_confidence numeric, p2_confidence numeric,
  issues jsonb not null default '[]',
  unique (import_id, row_index)
);

-- THE LEDGER. References handles, never people.
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  source_import_id uuid references result_imports(id),
  round int not null, table_number int,
  p1_identity_id uuid not null references player_identities(id),
  p2_identity_id uuid references player_identities(id),
  p1_games int default 0, p2_games int default 0, game_draws int default 0,
  result match_result not null,
  is_elimination boolean not null default false,
  created_at timestamptz not null default now()
);
create index matches_tournament_idx on matches (tournament_id, round);
create index matches_p1_idx on matches (p1_identity_id);
create index matches_p2_idx on matches (p2_identity_id);

create table match_corrections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  field text not null, old_value jsonb, new_value jsonb,
  reason text not null,
  corrected_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id uuid not null references players(id),
  deck_id uuid references decks(id),
  archetype_id uuid references archetypes(id),
  placement int,
  match_wins int default 0, match_losses int default 0, match_draws int default 0,
  game_wins int default 0, game_losses int default 0,
  dropped boolean not null default false,
  deck_missing_reason text,
  unique (tournament_id, player_id)
);
```

### 14. Cards, format, decks

#### 14.1 Card data is a repo artifact, not a table

The Scryfall `default_cards` bulk file is 75 MB gzipped and about a gigabyte unpacked — larger than the entire free Postgres tier, and it would be re-imported weekly forever. So card data never enters the database. It is fetched, pruned, and committed to the repo as a generated dataset, and the app reads that.

**What the job does** (`apps/jobs/build-card-data.ts`, run by GitHub Actions weekly and on manual dispatch):

1. Read `data/sets.json` — the PR-reviewed list of set codes to include.
2. Fetch the Scryfall bulk index, take the **`default_cards`** entry's `jsonl_download_uri`. That is every printing, English — not `oracle_cards`, which keeps one Scryfall-chosen printing per oracle id and so loses any card reprinted into the pool from an older set, and not `all_cards`, which is the same rows in every language. The payload is gzipped **JSONL**, so reading it is a `readline` loop; never `JSON.parse` the whole file.
3. Keep only printings whose `set` is in `sets.json`, and the oracle cards those printings belong to.
4. Keep only the fields the app actually uses. Drop rulings, prices, foreign names, purchase URIs, and every other field — they are the bulk of the payload.
5. Write `data/cards/oracle.json`, `data/cards/printings.json`, and `data/cards/meta.json` (source bulk timestamp, set list, record counts, job run date).
6. Open a PR if anything changed. A set release or errata therefore arrives as a reviewable diff rather than a silent mutation.

**Why this stays small.** Pruning to the format's set list is the whole trick. Planar Standard's pool is a handful of sets — roughly a couple of thousand oracle cards — not Magic's thirty-thousand-plus. Field-pruned and scoped this way the dataset is a few megabytes of JSON, which is fine to commit and fine to load. Measured on the six-set pool: 1,826 oracle cards, 2,916 printings, 2.4 MB.

**Printings outside the pool are not needed.** Decklists reference all sorts of printings (`FIN`, `M19`, `PLST`, promos), but the parser resolves cards **by name**, not by printing. The `(PLST) WOE-273` on a decklist line is kept in `deck_cards.set_code` as provenance and never has to resolve. Legality, set attribution, rarity, and images all come from the card's printing within the legal pool.

**`data/sets.json` vs `format_legal_sets`.** They are not the same thing and must not be confused:

- `data/sets.json` is the **fetch scope** — every set the dataset contains. Generous by design; adding one is a PR, because it changes a committed artifact.
- `format_legal_sets` is the **legal pool per format version**, admin-edited in the database, so special events can define custom pools without a deploy.

The format admin UI validates the second against the first and warns when an admin selects a set the dataset doesn't carry, which is the signal to run the job. Bans and exceptions stay entirely in the database — a B&R announcement must never require a pull request.

**Consequences elsewhere.** There are no `cards` or `card_printings` tables, so `oracle_id` columns in Postgres carry no foreign key. Integrity is enforced by a CI test (§22) asserting every `oracle_id` in the database exists in the dataset. Card filtering and sorting for the browser happen in the app against the loaded index rather than in SQL, which at this dataset size is faster anyway. If SQL-side card joins ever become genuinely necessary, the fallback is to load the pruned oracle table — a couple of thousand rows — into Postgres as a projection of the artifact; the artifact stays the source of truth either way.

```sql
-- NOTE: there are no `cards` or `card_printings` tables.
-- Card data lives in the repo as a build artifact (§14.1) because the Scryfall
-- bulk file is far larger than the free Postgres tier. Columns named `oracle_id`
-- below are Scryfall oracle IDs with no foreign key — integrity is enforced by
-- `dataset-integrity.test.ts` (§22) instead of by the database.

create table format_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null, effective_from date not null, effective_to date,
  notes_markdown text, is_current boolean not null default false
);
create unique index format_versions_one_current
  on format_versions (is_current) where is_current;
create table format_legal_sets (
  format_version_id uuid references format_versions(id) on delete cascade,
  set_code text not null, primary key (format_version_id, set_code)
);
create type card_ruling as enum ('banned','restricted','legal_exception');
create table format_card_rules (
  format_version_id uuid references format_versions(id) on delete cascade,
  oracle_id uuid not null,                     -- no FK: see note above
  ruling card_ruling not null, reason text, effective_from date,
  primary key (format_version_id, oracle_id)
);
create table format_constraints (
  format_version_id uuid primary key references format_versions(id) on delete cascade,
  min_maindeck int not null default 60, max_maindeck int,
  max_sideboard int not null default 15, max_copies int not null default 4,
  singleton boolean not null default false, extra_rules jsonb not null default '{}'
);

create type archetype_supertype as enum ('aggro','midrange','control','combo','other');
create table archetypes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, supertype archetype_supertype not null,
  color_identity text[], description_markdown text,
  parent_id uuid references archetypes(id),
  is_active boolean not null default true
);
create table archetype_aliases (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references archetypes(id) on delete cascade,
  alias text not null,
  normalized text generated always as (lower(regexp_replace(alias,'[^a-z0-9]','','gi'))) stored,
  unique (normalized)
);

create type deck_visibility as enum ('private','unlisted','public');
create table decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) on delete set null,
  player_id uuid references players(id),
  season_id uuid references seasons(id),
  format_version_id uuid references format_versions(id),
  archetype_id uuid references archetypes(id), archetype_raw text,
  visibility deck_visibility not null default 'public',
  description_markdown text, source_url text, raw_import text,
  submitted_via text check (submitted_via in ('registration','organizer','backfill','import')),
  locked_at timestamptz, parent_deck_id uuid references decks(id),
  is_legal boolean, validation jsonb,
  created_at timestamptz not null default now()
);
create table deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  oracle_id uuid,                              -- no FK: card data is a repo artifact
  card_name text not null, quantity int not null check (quantity > 0),
  board text not null default 'main' check (board in ('main','side','command')),
  set_code text, collector_number text
);
create index deck_cards_deck_idx on deck_cards (deck_id);
create index decks_season_idx on decks (season_id);
```

### 15. Derived stats

```sql
create table deck_metrics (
  deck_id uuid primary key references decks(id) on delete cascade,
  maindeck_count int not null, sideboard_count int not null,
  avg_mv_incl_lands numeric, avg_mv_excl_lands numeric, avg_mv_sideboard numeric,
  total_mv numeric,
  mv_buckets jsonb not null, color_counts jsonb not null, color_identity text[],
  type_counts jsonb not null, set_counts jsonb not null, rarity_counts jsonb not null,
  unresolved_cards int not null default 0,
  computed_at timestamptz not null default now()
);

create table card_stats (
  season_id uuid not null references seasons(id) on delete cascade,
  oracle_id uuid not null,                     -- no FK: card data is a repo artifact
  board text not null check (board in ('main','side')),
  decks_including int not null, total_copies int not null,
  avg_copies numeric not null, inclusion_rate numeric not null,
  primary_archetype_id uuid references archetypes(id),
  archetype_breakdown jsonb not null,
  game_wins int not null, game_losses int not null, win_rate numeric,
  by_event jsonb not null,
  primary key (season_id, oracle_id, board)
);

create table archetype_stats (
  season_id uuid not null references seasons(id) on delete cascade,
  archetype_id uuid not null references archetypes(id) on delete cascade,
  deck_count int not null,
  share_of_supertype numeric not null, share_of_field numeric not null,
  round_wins int not null, round_losses int not null, round_draws int not null,
  game_wins int not null, game_losses int not null,
  game_win_rate numeric, round_win_rate numeric,
  wilson_low numeric, wilson_high numeric,
  by_event jsonb not null,
  primary key (season_id, archetype_id)
);

create table deck_similarity (
  season_id uuid not null references seasons(id) on delete cascade,
  deck_a uuid not null references decks(id) on delete cascade,
  deck_b uuid not null references decks(id) on delete cascade,
  similarity numeric not null, shared_cards int not null,
  primary key (season_id, deck_a, deck_b), check (deck_a < deck_b)
);

create table deck_map_layout (
  season_id uuid not null references seasons(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  x numeric not null, y numeric not null, layout_version int not null default 1,
  primary key (season_id, deck_id)
);

create table matchup_stats (
  season_id uuid not null references seasons(id) on delete cascade,
  archetype_a uuid not null references archetypes(id),
  archetype_b uuid not null references archetypes(id),
  matches int not null,
  a_match_wins int not null, b_match_wins int not null, match_draws int not null,
  a_game_wins int not null, b_game_wins int not null,
  a_win_rate numeric, wilson_low numeric, wilson_high numeric,
  primary key (season_id, archetype_a, archetype_b), check (archetype_a < archetype_b)
);
```

### 16. Content and access

```sql
create type user_role   as enum ('reader','writer','organizer','admin');
create type post_status as enum ('draft','review','published','archived');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null, handle text unique, avatar_url text, bio text,
  role user_role not null default 'reader',
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, subtitle text,
  body_markdown text not null default '', excerpt text, hero_image_url text,
  tags text[] not null default '{}',
  status post_status not null default 'draft',
  author_id uuid not null references profiles(id),
  published_at timestamptz, reddit_url text, reddit_posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  title text not null, body_markdown text not null,
  edited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

**RLS summary.** Public select on `format_*`, `archetypes`, all derived stats, the `leaderboard` view, public decks, and published posts. Service-role write on every derived table and the ledger. Organizer-gated writes on tournaments and imports. Admin-only on merges, format edits, and role grants.

`packages/db/tests/rls.test.ts` hits every table as anon / reader / writer / organizer / admin and asserts the full allow-deny matrix. It runs in CI.

---

## Part V — Working together

### 17. Local development without credentials

The single most important thing for an open-source project: **a contributor must be productive in under five minutes without any secrets.**

```bash
pnpm install
pnpm --filter core test         # ✅ works immediately, zero setup
pnpm --filter adapters test     # ✅ works immediately, zero setup
```

For the full stack:

```bash
pnpm db:start                   # supabase start (local Docker)
pnpm db:reset                   # migrations + seed
pnpm dev                        # http://localhost:3000
```

**The seed matters.** `packages/db/seed/` ships an anonymized derivative of Season II — real decklists, real archetype distribution, synthetic handles and synthetic pairings. A contributor gets a site with a populated leaderboard, a working archetype map, and real charts on first run. Nobody can meaningfully improve a chart against an empty database.

Only the Discord webhook needs real credentials, and only for the task that posts to it. Sign-in does not: local Supabase accepts email and password, and its mail catcher holds the confirmation and magic links, so the whole auth surface can be worked on offline (E16.9). OAuth providers are optional everywhere — the sign-in page renders whichever ones the project has configured and offers email either way. Card data is committed to the repo, so legality and metrics work offline on a fresh clone too.

### 18. Parallel work streams

Once `packages/contracts` exists, these proceed simultaneously with no coordination:

| Stream                              | Needs                | Blocked by          |
| ----------------------------------- | -------------------- | ------------------- |
| **A** Decklist parsing + legality   | contracts            | nothing             |
| **B** Metrics + similarity + layout | contracts            | nothing             |
| **C** Elo engine                    | contracts            | nothing             |
| **D** Adapters                      | contracts            | nothing             |
| **E** Identity signals              | contracts            | nothing             |
| **F** Reddit transforms             | nothing              | nothing             |
| **G** Schema + migrations + RLS     | contracts            | nothing             |
| **H** Chart components              | contracts + fixtures | nothing (Storybook) |
| **I** MDX info pages                | nothing              | nothing             |
| **J** Auth + dashboard shell        | —                    | nothing             |
| **K** Services                      | all of the above     | A–G                 |
| **L** Feature slices                | K                    | K                   |

Eight of twelve streams are unblocked from day one. That is the payoff for the contracts-first layout.

### 19. Definition of done

A PR merges when all of these hold:

- [ ] One module, one responsibility. Describable in a sentence with no "and".
- [ ] `README.md` in the module directory: purpose, inputs, outputs, gotchas.
- [ ] Tests covering the happy path plus every known edge case, using `fixtures/` where real data exists.
- [ ] Pure modules import nothing from `db`, `next`, `react`, or `@supabase/*`.
- [ ] No new dependency without a line in the PR description explaining why.
- [ ] Any user-visible rate or percentage goes through `suppress-small-n` and shows `n`.
- [ ] Any changed metric definition is reflected in `content/pages/methodology.mdx`.
- [ ] `pnpm lint && pnpm test && pnpm depcruise` pass.

### 20. Issue taxonomy

Labels: `area:parser`, `area:adapters`, `area:metrics`, `area:ratings`, `area:identity`, `area:charts`, `area:content`, `area:db`, `area:infra`.

Good first issues are structurally abundant here, which is not an accident:

- Add an adapter for a new platform _(fixture + two functions)_
- Add an identity signal _(one scoring function)_
- Add a Reddit transform _(one before/after pair)_
- Handle a new decklist edge case _(one fixture + one branch)_
- Add a chart _(pure component + Storybook story)_
- Write an MDX info page _(no code at all)_

`CODEOWNERS` assigns a reviewer per `area:`. Not gatekeeping — just making sure nothing waits a week for review.

### 21. Architecture decision records

`docs/adr/` — one short file per decision, so nobody relitigates settled questions every three months. Seed it with these:

| ADR | Decision                                                              |
| --- | --------------------------------------------------------------------- |
| 001 | Markdown in Postgres, not a headless CMS _(Reddit is Markdown)_       |
| 002 | Card data is a pruned repo artifact, not a database table or live API |
| 003 | The ledger records handles, not people                                |
| 004 | Full recompute, never incremental updates                             |
| 005 | Adapter-based ingestion; no platform is special                       |
| 006 | Elo requires pairings; standings-only events are unrated              |
| 007 | Legality = oracle card in a legal set; any printing playable          |
| 008 | Derived statistics are never uploaded                                 |
| 009 | Identities auto-create; curation is merging, not claiming             |
| 010 | MDX in repo for info pages; database for articles                     |
| 011 | Decks are decoupled from ratings                                      |
| 012 | Sample-size guardrails enforced in shared components                  |
| 013 | Deck snapshots are immutable once an event starts                     |
| 014 | Only `mana-font` and `keyrune` from the MTG npm ecosystem             |

### 22. Testing strategy

| Layer              | Tool                    | Setup needed |
| ------------------ | ----------------------- | ------------ |
| `core`, `adapters` | Vitest + fixtures       | **none**     |
| `db`               | Vitest + local Supabase | Docker       |
| Services           | Vitest, seeded DB       | Docker       |
| Components         | Storybook + fixtures    | **none**     |
| End-to-end         | Playwright, seeded      | Docker       |

Four tests carry disproportionate weight — write them early and treat breakage as a release blocker:

1. **`metrics-golden.test.ts`** — import the `2026-08-01` decklists, assert computed `deck_metrics` match the existing spreadsheet column for column. Proves the derivation chain is faithful to numbers the community already trusts.
2. **`replay-identity.test.ts`** — two handles with separate histories produce two ratings; bind them to one player, re-run, assert one merged rating **and that no row in `matches` changed**. Encodes ADR 003 and 004.
3. **`rls.test.ts`** — the full allow-deny matrix across every role.
4. **`dataset-integrity.test.ts`** — every `oracle_id` stored in Postgres exists in `data/cards/`, and every set in `format_legal_sets` is present in `data/sets.json`. This replaces the foreign keys the card tables used to provide.

### 23. Governance

- **Licence:** MIT or Apache-2.0. Pick before the first external PR.
- **CoC:** Contributor Covenant.
- **Roles:** maintainers merge; area reviewers per `CODEOWNERS`; anyone opens issues and PRs.
- **Format authority stays with the community, not the repo.** Legal sets, bans, and archetype vocabulary are admin-edited data, not code changes. A PR must never be required to reflect a B&R announcement.

---

## Part VI — Feature specifications

Condensed. Detail per module lives in `docs/modules/`.

### 24. Analytics suite

| Visual                    | Source                                | Notes                                                                                                                                                           |
| ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Archetype map**         | `deck_map_layout` + `deck_similarity` | Canvas, server-computed layout, size = games played, colour = family. `?highlight=Stock+Up` lights every deck running a card — the thing a spreadsheet can't do |
| **Metagame share**        | `archetype_stats.by_event`            | 100% stacked area; toggle archetype / family / supertype, default family                                                                                        |
| **Archetype performance** | `archetype_stats`                     | Sorted by **deck count**, Wilson bars, `n` on every row, n<3 collapsed into "insufficient data"                                                                 |
| **Mana curve**            | `deck_metrics.mv_buckets`             | Per deck and per archetype vs field average                                                                                                                     |
| **Colour distribution**   | `deck_metrics.color_counts`           | Pie per event, share over time; `mana-font` symbols                                                                                                             |
| **Set adoption**          | `deck_metrics.set_counts`             | Stacked area — answers "did the new set change anything" with a number                                                                                          |
| **Card scores**           | `card_stats`                          | TanStack Table; win-rate column suppressed under 20 games                                                                                                       |
| **Card detail**           | `card_stats.by_event`                 | Inclusion over time, copies histogram, archetype breakdown                                                                                                      |
| **Matchup matrix**        | `matchup_stats`                       | Heatmap; group by family by default or most cells are empty                                                                                                     |
| **Deck visualizer**       | `deck_cards` + `deck_metrics`         | Image grid by type, curve, colours; ~150 lines, no package exists                                                                                               |

**Non-negotiable rules**, enforced in shared components: always show `n`; Wilson intervals on every rate; suppress below threshold; default sorts by volume not rate; card win rates labelled _"win rate of decks including this card"_, never _"card win rate"_.

### 25. Content

**MDX in `content/pages/`** — about, rules, getting-started, faq, methodology, ratings-explained, organizers, resources. Version-controlled, PR-reviewed, and able to embed live components (`<LegalSets />`, `<Banlist />`, `<Chart />`) so the rules page can't go stale after a B&R. Start with `@next/mdx`; graduate to Velite or content-collections if typed frontmatter and generated nav become worth it. Whitelist the MDX component set — MDX executes.

**Posts in Postgres** — ambassador articles, MDXEditor, draft → review → published, `to-reddit-markdown` behind a "Copy for Reddit" button, Discord webhook on publish.

> **The split rule:** if a non-technical ambassador needs to publish it this week without a PR, it's a post. If it describes how the site or format works and should be reviewed before changing, it's an MDX page.

### 26. Ingestion flows

**Results:** upload → detect adapter → parse → stage → resolve handles → review → commit → recompute. Content-hash idempotency; raw bytes archived permanently; `raw jsonb` retained so parser fixes re-run without the original file. Re-imports supersede wholesale and never merge. Corrections require a reason, write an audit row, trigger recompute, and post to Discord if any public rank moves.

**Decklists:** three paths, all optional to the ratings pipeline — folder drop with filename-encoded metadata, self-service paste, organizer entry. Unresolved card names keep the row, flag the deck, and exclude it from `card_stats` until fixed.

### 27. Backfill

1. Scrape all 98 Season II decklists from the archetype map HTML _(hover text contains player, date, both records, and the full list)_.
2. Cross-check records against the per-date xlsx sheets. Ignore every summary sheet — those are outputs.
3. Auto-create identities; **mine trailing parentheticals** — `C0d3 (c0d33)`, `Zaunus13 (LikoRS)`, `divnyi (Mika)` and the rest are explicit pairings already in the data.
4. Build `identity_exclusions` from co-appearance across all nine events.
5. Run the suggestion engine; work the remaining queue once.
6. Ratings stay empty until the first event with real pairings.

---

## Part VII — Roadmap

| Phase  | Deliverable                                                                                        | Streams |
| ------ | -------------------------------------------------------------------------------------------------- | ------- |
| **0**  | Contracts, workspace, CI, dependency rules, seed data                                              | —       |
| **1**  | Foundation: Next.js, Tailwind, shadcn, Supabase, auth, roles, dashboard shell. **Deploy day one.** | J       |
| **2**  | MDX info pages. Cheap, immediately useful, gives the site a reason to exist                        | I       |
| **3**  | Cards + format: `build-card-data` job, `data/sets.json`, format admin, `/cards`, legality engine   | A, G    |
| **4**  | Identity core: auto-create, merge/split, exclusions                                                | E, G    |
| **5**  | Ingestion: adapters, staging, ledger, commit, corrections                                          | D, K    |
| **6**  | Ratings: Elo replay, leaderboard, player pages                                                     | C, K, L |
| **7**  | Decks: parser, import paths, `deck_metrics`, backfill Season II, **golden test**                   | A, B    |
| **8**  | Analytics: stats builders, similarity, layout, the full chart suite                                | B, H    |
| **9**  | Articles + Reddit                                                                                  | F, L    |
| **10** | Payoff: matchup matrix, merge-suggestion queue, chart embeds, search                               | —       |

Identity and ratings precede decks: the leaderboard is what makes the site matter week to week, and it needs the smallest surface to ship.

---

## Part VIII — Risks

| Risk                                                  | Mitigation                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metric definitions drift from the trusted spreadsheet | Golden test; definitions published at `/methodology` next to the code                                                                                    |
| Standings-only imports ⇒ no ratings                   | Capability gating with an instructional message. Never approximate pairings                                                                              |
| melee's ~60-day data window closes                    | Export immediately post-event; archive raw permanently; put it on the organizer page                                                                     |
| Bad merge fuses two players                           | Co-appearance constraint enforced at merge time; self-play detected during replay; merges reversible                                                     |
| 45 archetypes over 98 decks ⇒ confetti charts         | Archetype families with a groupBy toggle; similarity ≥0.85 flags duplicates                                                                              |
| Small samples read as fact                            | `suppress-small-n` in shared components, enforced by the DoD checklist                                                                                   |
| Card win rate read as causation                       | Label as "decks including this card"; suppress under 20 games                                                                                            |
| Adapters break on export changes                      | `raw` preserved in staging; fixture test per adapter; `generic-csv` is the permanent floor                                                               |
| Contributors blocked by missing credentials           | Pure core needs none; seed data ships in-repo                                                                                                            |
| Service-role key reaching the client                  | Only importable from server contexts; CI grep; dependency-cruiser rule                                                                                   |
| Scryfall terms                                        | Bulk data only, no request loops, hotlink images, display attribution. The weekly job is a single bulk download                                          |
| Card dataset outgrows the repo                        | Pruned to `data/sets.json` and to used fields. If it stops being small, publish as a GitHub Release asset fetched at build time instead of committing it |
| Bus factor on format knowledge                        | ADRs; format rules are admin-edited data, never code                                                                                                     |

---

## Part IX — Open questions

1. Is the six-set pool (SOS · ECL · EOE · TDM · DFT · FDN) a rolling window or a curated list?

- Defined list (with option to define custom legal pools for special events, all based on oracle of card)

2. Deckbuilding constraints — standard 60/15/4, or modified?

- 60 card min for main deck, 15 card max sideboard, 4 copies of cards max (basic lands excluded)

3. Un-set and Secret Lair printings appear in decklists. Explicitly allowed, or merely tolerated?

- only care about oracle of card for legality, printing doesn't matter

4. Which platform hosts events — Challonge, melee, or a mix? Decides adapter priority.

- melee > challonge

5. Do historical Challonge brackets still exist for Seasons I–II? If so the whole back catalogue becomes ratable.

- yes but not worrying about this too much. Standalone script outside main app can handle backfill

6. Are bracket handles stable across events, or do people re-register under new names?

- assume stable, if new handle appears, they are a new user unless manually merged by an admin

7. Event weighting — flat, or do championships count more?

- flat for now, extentable later if desired

8. Who owns archetype naming, and is there an existing convention document?

- don't worry about archetype naming for now. Let's focus on data aggregation, then archetype naming can be a set of conditions
