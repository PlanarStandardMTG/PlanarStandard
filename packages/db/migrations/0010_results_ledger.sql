-- E13.8 — the results ledger.
--
-- §13 of the master plan, and §26. Four tables in two halves:
--
--   result_imports + staged_matches   the workshop. Everything an operator
--                                     uploaded, parsed and is still reviewing.
--   matches + match_corrections       the record. What actually happened, and
--                                     every edit anyone has made to it since.
--
-- Nothing derived lives here. Every rating and every statistic is recomputed
-- from `matches` by a full replay (ADR 004), so this table is the only thing in
-- the system that cannot be regenerated from something else.

create type import_status as enum (
  'uploaded', 'parsed', 'resolved', 'needs_review', 'committed', 'failed', 'superseded'
);

-- Every outcome a round can have, from the ledger's point of view. `bye` and
-- `double_loss` are here because Elo has to do something specific with each:
-- a bye rates nothing, and a double loss is not a draw.
create type match_result as enum ('p1_win', 'p2_win', 'draw', 'bye', 'double_loss');

create table result_imports (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  -- Persisted rather than derived, so it outlives a rename of the adapter.
  adapter_id text not null,
  source_platform text,
  -- Where the raw bytes were archived. They are kept permanently (§26): a
  -- parser fix has to be re-runnable years later, against the file as sent.
  file_path text,
  file_name text,
  -- The idempotency key. Uploading the same file twice is one import, which is
  -- what makes a retry after a timeout safe (E18.1).
  content_hash text not null,
  -- What this parse actually produced, not what the adapter can do. Elo consumes
  -- matches only, so a standings-only import leaves its tournament unrated
  -- (ADR 006) — and this column is where that is decided.
  capabilities text[] not null default '{}',
  -- Kept verbatim so a re-import needs no re-mapping (E12.2).
  column_mapping jsonb,
  status import_status not null default 'uploaded',
  row_count int,
  stats jsonb,
  errors jsonb,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  committed_at timestamptz,

  unique (tournament_id, content_hash)
);

-- A re-import supersedes its predecessor wholesale (§26), so "the import that
-- counts" is a query that runs constantly.
create index result_imports_tournament_status_idx
  on result_imports (tournament_id, status);

-- One source row, as the adapter read it.
--
-- `raw` is the whole point: with the source row retained per staged row, a
-- parser fix re-runs without the original file and without asking an organiser
-- to send it again (§26). Handles, never ids — resolution happens *after*
-- staging (ADR 003, E18.3), and the four resolution columns below are what it
-- writes back.
create table staged_matches (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references result_imports (id) on delete cascade,
  row_index int not null,
  raw jsonb not null,
  round int,
  table_number int,
  p1_handle text,
  p2_handle text,
  p1_games int,
  p2_games int,
  game_draws int,
  -- Text, not `match_result`, deliberately. A row whose result cell could not be
  -- normalized still has to stage — carrying a ParseIssue in `issues` — so the
  -- operator can see it and fix it. The enum would reject the row and lose it.
  result text,
  is_elimination boolean default false,
  p1_identity_id uuid references player_identities (id),
  p2_identity_id uuid references player_identities (id),
  -- How each side was resolved and how sure we were, recorded per side because
  -- one row routinely has a confident match on one handle and a guess on the
  -- other (E18.3).
  p1_method text,
  p2_method text,
  p1_confidence numeric,
  p2_confidence numeric,
  issues jsonb not null default '[]',

  unique (import_id, row_index)
);

create index staged_matches_import_idx on staged_matches (import_id);

-- THE LEDGER. References handles, never people (ADR 003).
--
-- This is the decision the whole identity system exists to protect. A match
-- points at a `player_identities` row, so merging two handles produces one
-- merged rating **without rewriting a single row here** — and un-merging is
-- possible for the same reason. Pointing these columns at `players` would make
-- every merge a destructive migration of history.
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  -- Which import produced this row. Null for a hand-entered match.
  source_import_id uuid references result_imports (id),
  round int not null,
  table_number int,
  p1_identity_id uuid not null references player_identities (id),
  -- Null on a bye: there is no opponent to record.
  p2_identity_id uuid references player_identities (id),
  p1_games int default 0,
  p2_games int default 0,
  game_draws int default 0,
  result match_result not null,
  is_elimination boolean not null default false,
  created_at timestamptz not null default now(),

  -- A bye is a round nobody played. Recording one with an opponent means the
  -- parser invented a pairing, which is the corruption ADR 006 is about.
  constraint matches_bye_has_no_opponent
    check (result <> 'bye' or p2_identity_id is null),

  -- Both sides resolving to the same identity is not a real match — it is a
  -- merge that should have been blocked by `co-appearance-exclusions` (E9.7).
  -- Rating it would hand somebody free points against themselves.
  constraint matches_no_self_pairing
    check (p2_identity_id is null or p1_identity_id <> p2_identity_id)
);

create index matches_tournament_idx on matches (tournament_id, round);
create index matches_p1_idx on matches (p1_identity_id);
create index matches_p2_idx on matches (p2_identity_id) where p2_identity_id is not null;

-- Every edit anyone has made to the record, and why.
--
-- `reason` is `not null` because that is the entire point: a correction with no
-- stated reason is indistinguishable from a mistake, and this table is what lets
-- a rating that moved be explained rather than merely observed (E18.6).
-- Append-only by convention — nothing updates or deletes a row here.
create table match_corrections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  corrected_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index match_corrections_match_idx on match_corrections (match_id);

alter table result_imports enable row level security;
alter table staged_matches enable row level security;
alter table matches enable row level security;
alter table match_corrections enable row level security;

-- No policy at all on the two staging tables, deliberately. They hold uploaded
-- file paths, raw source rows, and per-side resolution confidences — an
-- operator's workspace, not published record. RLS on with no policy is how to
-- say that; organizer-gated access is E14.3.

-- The ledger is public: every rating on this site is replayed from these rows,
-- and "computed from data you can read" is only true if they can be read. Scoped
-- to the tournament's own visibility, so a draft event's matches stay with it.
create policy matches_public_read on matches
  for select using (exists (
    select 1 from tournaments
    where tournaments.id = matches.tournament_id
      and tournaments.status <> 'draft'
  ));

-- Corrections are public wherever the match is. A correction log that only
-- admins can read would leave a moved rating unexplainable to the person it
-- moved, which is the opposite of why the log exists.
create policy match_corrections_public_read on match_corrections
  for select using (exists (
    select 1 from matches
    join tournaments on tournaments.id = matches.tournament_id
    where matches.id = match_corrections.match_id
      and tournaments.status <> 'draft'
  ));
