-- E18.22 — a finished tournament goes down two lines, each an admin's choice:
-- Elo (its matches rate) and decklists (its lists are stored against its
-- standings).
--
-- Both are chosen while the event waits, and fixed once it is processed:
-- after that, leaving a line is its own action (`/admin/processing`), because
-- it has to undo what the line did. An event on neither line is never claimed.

alter table event_completions
  add column elo boolean,
  add column decklists boolean;

-- Existing rows: Elo where the ingest rated the tournament, or where nothing
-- has been ingested yet and it is a Monthly; decklists for every Monthly.
update event_completions c
set elo = coalesce(
      (select t.is_rated from tournaments t
       where t.source = c.source and t.external_id = c.external_id),
      c.name ~* '\mmonthly\M'
    ),
    decklists = c.name ~* '\mmonthly\M';

alter table event_completions
  alter column elo set not null,
  alter column decklists set not null;

/*
 * A new event is on both lines when it is a Monthly — `core/elo/rated-by-default`,
 * the whole word — and on neither otherwise. A trigger rather than a default,
 * because both `recordCompletions` and `requeue_event_completions` insert.
 */
create function public.event_completion_lines() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.elo := coalesce(new.elo, new.name ~* '\mmonthly\M');
  new.decklists := coalesce(new.decklists, new.name ~* '\mmonthly\M');
  return new;
end;
$$;

create trigger event_completion_lines before insert on event_completions
  for each row execute function public.event_completion_lines();

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
      and (p.elo or p.decklists)
      and (only_source is null or p.source = only_source)
      and p.attempts < max_attempts
      and (p.claimed_at is null or p.claimed_at < lease_cutoff)
    order by p.detected_at
    limit max_rows
    for update skip locked
  )
  returning c.*;
$$;

/*
 * `requeue_event_completions` counted every unprocessed row as waiting; one on
 * neither line is not.
 */
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
    and (c.elo or c.decklists)
    and (only_source is null or c.source = only_source);

  return waiting;
end;
$$;
