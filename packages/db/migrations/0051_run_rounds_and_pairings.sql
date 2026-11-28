-- E26.12 — a run's rounds, its pairings, and the trail behind every result (§28).
--
-- Who may change a result is enforced here rather than in a route, because a route
-- can be skipped and a trigger cannot. Either player reports, the other confirms,
-- and the run's organizer can enter or overrule anything. Every change is logged
-- with who made it, by a trigger, so no write path can forget to.

create type run_round_kind as enum ('swiss', 'elimination');
create type run_result_status as enum ('pending', 'reported', 'confirmed');

create table run_rounds (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references tournament_runs (id) on delete cascade,
  -- Counts through the whole run, so the first cut round follows the last Swiss one.
  number int not null check (number >= 1),
  kind run_round_kind not null,
  paired_at timestamptz not null default now(),
  unique (run_id, number)
);

create table run_pairings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references run_rounds (id) on delete cascade,
  -- Carried from the round so a policy, and a Realtime filter, need no join.
  run_id uuid not null references tournament_runs (id) on delete cascade,
  table_number int not null check (table_number >= 1),
  p1_entrant_id uuid not null references run_entrants (id),
  -- Null is a bye: a 2–0 win, confirmed from the moment it is paired.
  p2_entrant_id uuid references run_entrants (id),
  p1_wins smallint check (p1_wins between 0 and 3),
  p2_wins smallint check (p2_wins between 0 and 3),
  draws smallint check (draws between 0 and 3),
  status run_result_status not null default 'pending',
  reported_by uuid references profiles (id),
  reported_at timestamptz,
  confirmed_by uuid references profiles (id),
  confirmed_at timestamptz,
  unique (round_id, table_number),
  constraint run_pairings_two_players check (p1_entrant_id <> p2_entrant_id),
  constraint run_pairings_games_together check (
    (p1_wins is null) = (p2_wins is null) and (p1_wins is null) = (draws is null)
  ),
  constraint run_pairings_reported_has_games check (status = 'pending' or p2_entrant_id is null or p1_wins is not null),
  constraint run_pairings_bye check (
    p2_entrant_id is not null or (status = 'confirmed' and p1_wins is null)
  )
);

create index run_pairings_round_idx on run_pairings (round_id);
create index run_pairings_run_idx on run_pairings (run_id);
create index run_pairings_p1_idx on run_pairings (p1_entrant_id);
create index run_pairings_p2_idx on run_pairings (p2_entrant_id) where p2_entrant_id is not null;

create table run_result_changes (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references run_pairings (id) on delete cascade,
  -- Null only for a change the server made as itself.
  changed_by uuid references profiles (id),
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now()
);

create index run_result_changes_pairing_idx on run_result_changes (pairing_id, created_at);

alter table run_rounds enable row level security;
alter table run_pairings enable row level security;
alter table run_result_changes enable row level security;

revoke insert, update on run_pairings from anon, authenticated;
grant insert (round_id, run_id, table_number, p1_entrant_id, p2_entrant_id) on run_pairings to authenticated;
grant update (p1_wins, p2_wins, draws, status) on run_pairings to authenticated;

revoke insert, update, delete on run_result_changes from anon, authenticated;

/*
 * Nobody plays twice in one round. A unique constraint per column cannot see a
 * player who is p1 at one table and p2 at another.
 */
create function public.run_pairings_once_per_round() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.run_pairings p
    where p.round_id = new.round_id and p.id <> new.id
      and (p.p1_entrant_id in (new.p1_entrant_id, new.p2_entrant_id)
        or p.p2_entrant_id in (new.p1_entrant_id, new.p2_entrant_id))
  ) then
    raise exception 'an entrant is already paired in this round' using errcode = '23505';
  end if;
  if new.run_id <> (select r.run_id from public.run_rounds r where r.id = new.round_id) then
    raise exception 'a pairing belongs to its round''s run' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger run_pairings_once_per_round before insert or update of round_id, p1_entrant_id, p2_entrant_id
  on run_pairings for each row execute function public.run_pairings_once_per_round();

/*
 * The result rules (§28, E26.20). The organizer or an admin may set anything. A player
 * in the pairing may report — any time before it is confirmed — or confirm what the
 * other player reported, unchanged. The top cut has no draws (MTR §2.4).
 *
 * Definer, to read the run and the caller's entrant whatever their policies say.
 */
create function public.run_pairings_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_profile_id();
  kind public.run_round_kind;
  run_state public.run_state;
  games_changed boolean := (new.p1_wins, new.p2_wins, new.draws)
    is distinct from (old.p1_wins, old.p2_wins, old.draws);
begin
  select rd.kind, r.state into kind, run_state
  from public.run_rounds rd join public.tournament_runs r on r.id = rd.run_id
  where rd.id = new.round_id;

  if kind = 'elimination' and new.p1_wins is not null and new.p1_wins = new.p2_wins then
    raise exception 'a top cut match cannot be a draw' using errcode = '23514';
  end if;
  if old.p2_entrant_id is null and (games_changed or new.status <> old.status) then
    raise exception 'a bye has no result to change' using errcode = '42501';
  end if;
  -- Games without a status are a report, whoever sends them.
  if games_changed and new.p1_wins is not null and new.status = 'pending' then
    new.status := 'reported';
  end if;

  -- The server, acting as itself.
  if me is null and auth.uid() is null then
    return new;
  end if;

  if public.manages_run(new.run_id) then
    if new.status = 'confirmed' and old.status <> 'confirmed' then
      new.confirmed_by := me;
      new.confirmed_at := now();
    elsif new.status <> 'confirmed' then
      new.confirmed_by := null;
      new.confirmed_at := null;
    end if;
    if games_changed then
      new.reported_by := me;
      new.reported_at := now();
    end if;
    return new;
  end if;

  if run_state not in ('running', 'top_cut') then
    raise exception 'results are reported while a run is being played' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.run_entrants e
    where e.profile_id = me and e.id in (old.p1_entrant_id, old.p2_entrant_id)
  ) then
    raise exception 'only the two players report a result' using errcode = '42501';
  end if;
  if old.status = 'confirmed' then
    raise exception 'a confirmed result is changed by the organizer' using errcode = '42501';
  end if;

  if games_changed or new.status = 'reported' then
    if new.p1_wins is null then
      raise exception 'a report needs the games' using errcode = '23514';
    end if;
    new.status := 'reported';
    new.reported_by := me;
    new.reported_at := now();
    return new;
  end if;

  if new.status = 'confirmed' and old.status = 'reported' and old.reported_by is distinct from me then
    new.confirmed_by := me;
    new.confirmed_at := now();
    return new;
  end if;

  raise exception 'the other player confirms a reported result' using errcode = '42501';
end;
$$;

create trigger run_pairings_guard before update on run_pairings
  for each row execute function public.run_pairings_guard();

-- A bye is confirmed the moment it is paired.
create function public.run_pairings_bye_confirmed() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.p2_entrant_id is null then
    new.status := 'confirmed';
  else
    new.status := 'pending';
    new.p1_wins := null;
    new.p2_wins := null;
    new.draws := null;
  end if;
  return new;
end;
$$;

create trigger run_pairings_bye_confirmed before insert on run_pairings
  for each row execute function public.run_pairings_bye_confirmed();

create function public.run_pairings_log_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.run_result_changes (pairing_id, changed_by, before, after)
  values (
    new.id,
    public.current_profile_id(),
    jsonb_build_object('p1_wins', old.p1_wins, 'p2_wins', old.p2_wins, 'draws', old.draws, 'status', old.status),
    jsonb_build_object('p1_wins', new.p1_wins, 'p2_wins', new.p2_wins, 'draws', new.draws, 'status', new.status)
  );
  return new;
end;
$$;

create trigger run_pairings_log_change after update on run_pairings
  for each row
  when ((old.p1_wins, old.p2_wins, old.draws, old.status) is distinct from (new.p1_wins, new.p2_wins, new.draws, new.status))
  execute function public.run_pairings_log_change();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create policy run_rounds_read on run_rounds for select using (
  exists (select 1 from public.tournament_runs r where r.id = run_id)
);

create policy run_rounds_manager_insert on run_rounds
  for insert to authenticated with check (public.manages_run(run_id));

-- A re-pair replaces an unplayed round whole: nothing in it may have a result yet.
create policy run_rounds_manager_delete on run_rounds
  for delete to authenticated
  using (
    public.manages_run(run_id)
    and not exists (
      select 1 from public.run_pairings p
      where p.round_id = run_rounds.id and p.p2_entrant_id is not null and p.status <> 'pending'
    )
  );

create policy run_pairings_read on run_pairings for select using (
  exists (select 1 from public.tournament_runs r where r.id = run_id)
);

create policy run_pairings_manager_insert on run_pairings
  for insert to authenticated with check (public.manages_run(run_id));

-- The players and the organizer; `run_pairings_guard` decides what each may change.
create policy run_pairings_update on run_pairings
  for update to authenticated
  using (
    public.manages_run(run_id)
    or exists (
      select 1 from public.run_entrants e
      where e.profile_id = public.current_profile_id()
        and e.id in (p1_entrant_id, p2_entrant_id)
    )
  )
  with check (true);

create policy run_result_changes_manager_read on run_result_changes
  for select to authenticated
  using (
    public.manages_run((select p.run_id from public.run_pairings p where p.id = pairing_id))
  );

/*
 * Whether the caller is paired against this entrant right now: both in the run's
 * latest round, while it is being played. What lets a player read their opponent's
 * Arena name and send a Direct Challenge (§28), and nothing longer than that.
 */
create function public.is_current_opponent(p_entrant_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.run_pairings p
    join public.run_rounds rd on rd.id = p.round_id
    join public.tournament_runs r on r.id = p.run_id
    join public.run_entrants me on me.run_id = p.run_id and me.profile_id = public.current_profile_id()
    where r.state in ('running', 'top_cut')
      and rd.number = (select max(x.number) from public.run_rounds x where x.run_id = p.run_id)
      and (
        (p.p1_entrant_id = me.id and p.p2_entrant_id = p_entrant_id)
        or (p.p2_entrant_id = me.id and p.p1_entrant_id = p_entrant_id)
      )
  );
$$;

revoke all on function public.is_current_opponent(uuid) from public, anon;
grant execute on function public.is_current_opponent(uuid) to authenticated, service_role;

create policy run_guest_contacts_opponent_read on run_guest_contacts
  for select to authenticated
  using (public.is_current_opponent(entrant_id));
