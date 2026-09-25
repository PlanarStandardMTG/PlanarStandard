-- E23.13 — a tournament that has just ended is noticed once, and handled once.
--
-- The calendar refresh replaces `external_events` wholesale, so it cannot be the
-- record of what has been handled: a row it prunes and later re-adds would look
-- new again. This table is that record. A row is written the first time a
-- refresh sees an event reach `complete` — it was absent, or in any other state,
-- in the cache before — and the primary key makes a second sighting a no-op.
--
-- Whatever runs the queue (a cron, a manual trigger) claims rows with
-- `claim_event_completions`; once `processed_at` is set, nothing fetches that
-- event again. The runner is not decided here, which is the point.

create table event_completions (
  source text not null,
  external_id text not null,
  -- The event's public name, so a log or an admin page can say which it was.
  name text not null,
  detected_at timestamptz not null default now(),
  -- A lease, not a lock: a runner that dies mid-event lets the row be claimed
  -- again once the lease is older than the cutoff the next runner passes.
  claimed_at timestamptz,
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text,
  primary key (source, external_id)
);

-- The queue is the unprocessed rows, oldest first.
create index event_completions_pending_idx on event_completions (detected_at)
  where processed_at is null;

alter table event_completions enable row level security;

-- Runners use the service-role client. The only person who may look at the
-- queue, or send everything round it again, is an admin (`/admin/processing`).
create policy event_completions_admin_all on event_completions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

/*
 * Claim up to `max_rows` unprocessed completions, oldest first, and return them.
 *
 * A row is claimable when nobody holds it, or its lease is older than
 * `lease_cutoff`, and it has been tried fewer than `max_attempts` times — a
 * tournament that fails every time stops being retried rather than spending the
 * source's rate limit forever. `skip locked` lets two runners claim side by side
 * without taking the same row. `only_source` narrows the claim to one calendar,
 * for a runner that can only handle that source's results.
 */
create function public.claim_event_completions(
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

revoke all on function public.claim_event_completions(int, timestamptz, int, text)
  from public, anon, authenticated;
grant execute on function public.claim_event_completions(int, timestamptz, int, text) to service_role;

/*
 * Send every finished tournament round the queue again: each queued event
 * becomes unprocessed with a clean slate, and a complete event the calendar
 * holds that was never queued joins it. Returns how many are now waiting.
 *
 * `claimed_at` is left alone, so an event a runner is working on right now stays
 * its until the lease runs out rather than being handed to a second runner.
 * `only_source` limits it to one calendar. Invoker, so only an admin can call it
 * (`event_completions_admin_all`).
 */
create function public.requeue_event_completions(only_source text default null)
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

revoke all on function public.requeue_event_completions(text) from public, anon;
grant execute on function public.requeue_event_completions(text) to authenticated, service_role;
