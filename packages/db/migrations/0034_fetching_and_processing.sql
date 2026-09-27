-- E25.1 — fetching an event and deciding what it counts towards are two jobs.
--
-- The Elo and decklist lines (E18.22) sat on `event_completions`, so they were
-- chosen before the fetch and changed what it stored. They move to the
-- tournament: a fetch stores everything its source sent, and `/admin/processing`
-- decides afterwards, from our own data, what each stored event counts towards.

-- `is_rated` stays what the ladder reads. `include_in_elo` is the admin's choice,
-- staged until the next recompute copies it across, so several changes cost one
-- full replay (ADR 004). The two differ exactly while a change is waiting.
alter table tournaments
  add column include_in_elo boolean,
  add column in_card_stats boolean not null default false;

update tournaments set include_in_elo = is_rated;

alter table tournaments alter column include_in_elo set not null;

/*
 * A new tournament starts with the ladder and the choice agreeing, whoever
 * inserts it — an ingest, an organiser's import, the seed — unless it says
 * otherwise. A trigger, because a default cannot read another column.
 */
create function public.tournament_include_in_elo() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.include_in_elo := coalesce(new.include_in_elo, new.is_rated);
  return new;
end;
$$;

create trigger tournament_include_in_elo before insert on tournaments
  for each row execute function public.tournament_include_in_elo();

update tournaments t
set in_card_stats = coalesce(
  (select c.decklists from event_completions c
   where c.source = t.source and c.external_id = t.external_id),
  t.name ~* '\mmonthly\M'
);

drop trigger event_completion_lines on event_completions;
drop function public.event_completion_lines();

alter table event_completions
  drop column elo,
  drop column decklists;

/*
 * Each tournament with how much of it is stored: matches, standings, and the
 * standings that have a deck. What both admin pages read to say what is missing.
 * Invoker's rights, so a draft stays hidden from anyone the base tables hide it from.
 */
create view tournament_coverage with (security_invoker = true) as
select
  t.id,
  t.source,
  t.external_id,
  (select count(*) from matches m where m.tournament_id = t.id)::integer as match_count,
  (select count(*) from tournament_entries e where e.tournament_id = t.id)::integer as entry_count,
  (select count(*) from tournament_entries e
   where e.tournament_id = t.id and e.deck_id is not null)::integer as deck_count
from tournaments t;

/*
 * `claim_event_completions` gains `only_external_id`, so an admin's "re-fetch"
 * can take the one event they pressed it on, under the same lease as a cron.
 */
drop function public.claim_event_completions(int, timestamptz, int, text);

create function public.claim_event_completions(
  max_rows int,
  lease_cutoff timestamptz,
  max_attempts int,
  only_source text default null,
  only_external_id text default null
) returns setof public.event_completions
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.event_completions c
  set claimed_at = now(), attempts = c.attempts + 1
  where (c.source, c.external_id) in (
    select p.source, p.external_id
    from public.event_completions p
    where p.processed_at is null
      and (only_source is null or p.source = only_source)
      and (only_external_id is null or p.external_id = only_external_id)
      and p.attempts < max_attempts
      and (p.claimed_at is null or p.claimed_at < lease_cutoff)
    order by p.detected_at
    limit max_rows
    for update skip locked
  )
  returning c.*;
$$;

revoke all on function public.claim_event_completions(int, timestamptz, int, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_event_completions(int, timestamptz, int, text, text)
  to service_role;
