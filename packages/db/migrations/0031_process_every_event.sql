-- E18.24 — every finished tournament is processed, whatever its lines.
--
-- Processing fetches an event's results and writes its tournament, matches and
-- standings, which is what gives it a page (E20.14). The lines now decide only
-- what happens after that: Elo rates it, decklists stores its lists. An event
-- on neither is stored unrated, and the ladder never reads it (ADR 006).

create or replace function public.claim_event_completions(
  max_rows int,
  lease_cutoff timestamptz,
  max_attempts int,
  only_source text default null
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
      and p.attempts < max_attempts
      and (p.claimed_at is null or p.claimed_at < lease_cutoff)
    order by p.detected_at
    limit max_rows
    for update skip locked
  )
  returning c.*;
$$;

create or replace function public.requeue_event_completions(only_source text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  waiting integer;
begin
  update public.event_completions c
  set processed_at = null, attempts = 0, last_error = null
  where (only_source is null or c.source = only_source)
    and (c.processed_at is not null or c.attempts > 0 or c.last_error is not null);

  insert into public.event_completions (source, external_id, name)
  select e.source, e.external_id, e.name
  from public.external_events e
  where e.state = 'complete'
    and (only_source is null or e.source = only_source)
  on conflict (source, external_id) do nothing;

  select count(*)::integer into waiting
  from public.event_completions c
  where c.processed_at is null
    and (only_source is null or c.source = only_source);

  return waiting;
end;
$$;
