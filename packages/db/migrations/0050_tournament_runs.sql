-- E26.11 — runs: events organized and played on the site (§28, ADR 015).
--
-- A run holds its own name, date and format versions while it is live, and gets a
-- `tournaments` row only when it finishes and is imported like any other event
-- (`tournament_id`). Until then nothing here touches the ledger, and the tournament
-- reads, which rely on a draft event being hidden, never see a live one.
--
-- Contact names are private (§28), so a guest's Arena username lives in its own
-- table rather than on the publicly readable entrant row. A member's lives in
-- `profile_contacts` (E26.15).

create type run_state as enum ('draft', 'registration', 'running', 'top_cut', 'finished', 'cancelled');

-- A member's matches enter the ledger under their profile handle, on this platform.
alter type identity_platform add value if not exists 'site';

create table tournament_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  starts_at timestamptz,
  description text,
  organizer_id uuid not null references profiles (id),
  state run_state not null default 'draft',
  -- Every random choice in core/runs derives from this. Never updated, so a re-pair
  -- reproduces and standings never reorder.
  seed text not null default substr(md5(gen_random_uuid()::text), 1, 16),
  swiss_rounds int not null default 0 check (swiss_rounds between 0 and 20),
  top_cut int not null default 0 check (top_cut between 0 and 512),
  tournament_id uuid unique references tournaments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournament_runs_organizer_idx on tournament_runs (organizer_id);
create index tournament_runs_state_starts_idx on tournament_runs (state, starts_at);

create trigger tournament_runs_set_updated_at before update on tournament_runs
  for each row execute function set_updated_at();

-- The versions a run allows, in order, as `tournament_formats` holds them for an event.
create table tournament_run_formats (
  run_id uuid not null references tournament_runs (id) on delete cascade,
  format_version_id uuid not null references format_versions (id),
  position smallint not null,
  primary key (run_id, format_version_id),
  unique (run_id, position)
);

create index tournament_run_formats_format_version_idx on tournament_run_formats (format_version_id);

create table run_entrants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references tournament_runs (id) on delete cascade,
  -- Null for a guest the organizer typed in.
  profile_id uuid references profiles (id),
  display_name text not null check (length(trim(display_name)) > 0),
  -- The profile handle a member registered under; a guest goes in as run-guest-<id>.
  handle text,
  checked_in boolean not null default false,
  -- Rounds paired when the drop came in; 0 is before round 1 (MTR §2.10).
  dropped_after_round int check (dropped_after_round >= 0),
  created_at timestamptz not null default now(),
  unique (run_id, profile_id),
  constraint run_entrants_member_has_handle check ((profile_id is null) = (handle is null))
);

create index run_entrants_profile_idx on run_entrants (profile_id) where profile_id is not null;

create table run_guest_contacts (
  entrant_id uuid primary key references run_entrants (id) on delete cascade,
  arena_username text not null check (length(trim(arena_username)) > 0)
);

alter table tournament_runs enable row level security;
alter table tournament_run_formats enable row level security;
alter table run_entrants enable row level security;
alter table run_guest_contacts enable row level security;

/*
 * Whether the caller runs this run: its organizer, while they still hold the role,
 * or an admin. Definer, so the entrant and contact policies can ask without the
 * run's own policy in the way.
 */
create function public.manages_run(p_run_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or (
    public.has_role('organizer') and exists (
      select 1 from public.tournament_runs r
      where r.id = p_run_id and r.organizer_id = public.current_profile_id()
    )
  );
$$;

revoke all on function public.manages_run(uuid) from public, anon;
grant execute on function public.manages_run(uuid) to authenticated, service_role;

-- What a client may write at all. The seed, the state's default, the link to the
-- finished tournament and every id are the database's or the server's to set.
revoke insert, update on tournament_runs from anon, authenticated;
grant insert (name, starts_at, description, organizer_id, swiss_rounds, top_cut)
  on tournament_runs to authenticated;
grant update (name, starts_at, description, organizer_id, swiss_rounds, top_cut, state)
  on tournament_runs to authenticated;

revoke insert, update on run_entrants from anon, authenticated;
grant insert (run_id, profile_id, display_name, handle) on run_entrants to authenticated;
grant update (display_name, checked_in, dropped_after_round) on run_entrants to authenticated;

-- ---------------------------------------------------------------------------
-- tournament_runs
-- ---------------------------------------------------------------------------

-- A draft is the organizer's scratch pad; past that, a run is public. Two policies,
-- because the role checks are not anon's to call. Columns, not `manages_run`, so a
-- row being inserted can be returned to the organizer who wrote it.
create policy tournament_runs_public_read on tournament_runs for select using (state <> 'draft');

create policy tournament_runs_manager_read on tournament_runs
  for select to authenticated
  using (
    public.has_role('admin')
    or (public.has_role('organizer') and organizer_id = public.current_profile_id())
  );

create policy tournament_runs_organizer_insert on tournament_runs
  for insert to authenticated
  with check (public.has_role('organizer') and organizer_id = public.current_profile_id());

create policy tournament_runs_manager_update on tournament_runs
  for update to authenticated
  using (
    public.has_role('admin')
    or (public.has_role('organizer') and organizer_id = public.current_profile_id())
  )
  with check (
    public.has_role('admin')
    or (public.has_role('organizer') and organizer_id = public.current_profile_id())
  );

-- Only a draft can be deleted; anything that has been public is cancelled instead.
create policy tournament_runs_manager_delete on tournament_runs
  for delete to authenticated
  using (
    state = 'draft' and (
      public.has_role('admin')
      or (public.has_role('organizer') and organizer_id = public.current_profile_id())
    )
  );

-- ---------------------------------------------------------------------------
-- tournament_run_formats
-- ---------------------------------------------------------------------------

create policy tournament_run_formats_read on tournament_run_formats for select using (
  exists (select 1 from public.tournament_runs r where r.id = run_id)
);

create policy tournament_run_formats_manager_all on tournament_run_formats
  for all to authenticated
  using (public.manages_run(run_id))
  with check (public.manages_run(run_id));

-- ---------------------------------------------------------------------------
-- run_entrants
-- ---------------------------------------------------------------------------

-- Readable wherever its run is.
create policy run_entrants_read on run_entrants for select using (
  exists (select 1 from public.tournament_runs r where r.id = run_id)
);

-- A member registers only themself, under their own handle, while registration is
-- open. Nobody is added once the run has started (§28).
create policy run_entrants_self_register on run_entrants
  for insert to authenticated
  with check (
    public.has_role('reader')
    and profile_id = public.current_profile_id()
    and handle = (select p.handle from public.profiles p where p.id = public.current_profile_id())
    and exists (
      select 1 from public.tournament_runs r where r.id = run_id and r.state = 'registration'
    )
  );

create policy run_entrants_self_withdraw on run_entrants
  for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.tournament_runs r where r.id = run_id and r.state = 'registration'
    )
  );

-- The organizer adds guests before the run starts. Members add themselves.
create policy run_entrants_manager_add_guest on run_entrants
  for insert to authenticated
  with check (
    profile_id is null
    and public.manages_run(run_id)
    and exists (
      select 1 from public.tournament_runs r
      where r.id = run_id and r.state in ('draft', 'registration')
    )
  );

-- Check-in, drops and a corrected name.
create policy run_entrants_manager_update on run_entrants
  for update to authenticated
  using (public.manages_run(run_id))
  with check (public.manages_run(run_id));

create policy run_entrants_manager_remove on run_entrants
  for delete to authenticated
  using (
    public.manages_run(run_id)
    and exists (
      select 1 from public.tournament_runs r
      where r.id = run_id and r.state in ('draft', 'registration')
    )
  );

-- ---------------------------------------------------------------------------
-- run_guest_contacts — the opponent's read arrives with pairings (E26.12)
-- ---------------------------------------------------------------------------

create policy run_guest_contacts_manager_all on run_guest_contacts
  for all to authenticated
  using (
    public.manages_run((select e.run_id from public.run_entrants e where e.id = entrant_id))
  )
  with check (
    public.manages_run((select e.run_id from public.run_entrants e where e.id = entrant_id))
    and exists (select 1 from public.run_entrants e where e.id = entrant_id and e.profile_id is null)
  );
