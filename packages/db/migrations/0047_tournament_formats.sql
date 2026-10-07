-- E20.66 — an event may allow more than one format version.
--
-- `tournament_formats` holds every version an event allowed, in the order an
-- admin chose them. `tournaments.format_version_id` stays as the first of them:
-- the version a deck legal in none falls back to, and what a fresh insert
-- defaults (0045). Which version each of an event's decks is checked against
-- is decided in the app, since legality needs the card data, which Postgres
-- does not hold.

create table tournament_formats (
  tournament_id uuid not null references tournaments (id) on delete cascade,
  format_version_id uuid not null references format_versions (id),
  position smallint not null,
  primary key (tournament_id, format_version_id),
  unique (tournament_id, position)
);

create index tournament_formats_format_version_idx on tournament_formats (format_version_id);

alter table tournament_formats enable row level security;

-- Readable wherever its event is.
create policy tournament_formats_public_read on tournament_formats for select using (
  exists (select 1 from public.tournaments t where t.id = tournament_id)
);

/*
 * A new event's one version becomes its list. Definer, because an organizer
 * inserts the event under their own policies and has none on this table.
 */
create function public.tournament_first_format() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.format_version_id is not null then
    insert into public.tournament_formats (tournament_id, format_version_id, position)
    values (new.id, new.format_version_id, 1);
  end if;
  return new;
end;
$$;

create trigger tournament_first_format after insert on tournaments
  for each row execute function public.tournament_first_format();

/*
 * Replace an event's versions with these, in this order, and make the first its
 * `format_version_id`. The event's decks are placed by the caller afterwards.
 */
create function public.set_tournament_formats(p_tournament_id uuid, p_format_version_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_format_version_ids, 1), 0) = 0 then
    raise exception 'an event needs at least one format version';
  end if;

  update public.tournaments set format_version_id = p_format_version_ids[1]
  where id = p_tournament_id;

  delete from public.tournament_formats where tournament_id = p_tournament_id;
  insert into public.tournament_formats (tournament_id, format_version_id, position)
  select p_tournament_id, chosen.id, chosen.position
  from unnest(p_format_version_ids) with ordinality as chosen (id, position);
end;
$$;

revoke all on function public.set_tournament_formats(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_tournament_formats(uuid, uuid[]) to service_role;

-- Superseded: moving decks in SQL could only give them all the one version.
drop function public.set_tournament_format(uuid, uuid);

insert into tournament_formats (tournament_id, format_version_id, position)
select id, format_version_id, 1 from tournaments where format_version_id is not null;
