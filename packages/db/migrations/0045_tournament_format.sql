-- E25.8 — every event is played in a format version, and so is each deck it made.
--
-- A deck's `format_version_id` is the version it is checked against (E20.54).
-- For an event's decks that is the event's version, which an admin can change
-- on `/admin/processing`. A member's own saved deck that an entry names keeps
-- the version its owner chose.

/*
 * A new tournament starts in the version in force, whoever inserts it, unless
 * it names one. A trigger, as with `include_in_elo`, because a default cannot
 * read another table.
 */
create function public.tournament_format_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.format_version_id := coalesce(
    new.format_version_id,
    (select v.id from public.format_versions v where v.is_current)
  );
  return new;
end;
$$;

create trigger tournament_format_version before insert on tournaments
  for each row execute function public.tournament_format_version();

/*
 * Put an event in a format version, and every deck the event made with it, in
 * one transaction so the two never disagree. Returns how many decks moved.
 */
create function public.set_tournament_format(p_tournament_id uuid, p_format_version_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moved integer;
begin
  update public.tournaments set format_version_id = p_format_version_id
  where id = p_tournament_id;

  update public.decks d set format_version_id = p_format_version_id
  from public.tournament_entries e
  where e.tournament_id = p_tournament_id
    and e.deck_id = d.id
    and d.submitted_via is distinct from 'import'
    and d.format_version_id is distinct from p_format_version_id;
  get diagnostics moved = row_count;
  return moved;
end;
$$;

revoke all on function public.set_tournament_format(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_tournament_format(uuid, uuid) to service_role;

-- Events stored before this, and their decks, take the version in force today.
update tournaments
set format_version_id = (select id from format_versions where is_current)
where format_version_id is null;

update decks d
set format_version_id = t.format_version_id
from tournament_entries e
join tournaments t on t.id = e.tournament_id
where e.deck_id = d.id
  and d.submitted_via is distinct from 'import'
  and d.format_version_id is null;
