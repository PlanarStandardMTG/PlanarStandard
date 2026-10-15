-- E26.14 — post a round and its pairings in one transaction.
--
-- Two requests over PostgREST could leave a round with no pairings in it. Invoker,
-- so every policy still applies to the caller: only the run's organizer or an admin
-- can post, and a round that already has a result in it cannot be replaced.

create function public.post_run_round(
  p_run_id uuid,
  p_number int,
  p_kind public.run_round_kind,
  p_pairings jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_round_id uuid;
begin
  -- A re-pair replaces the unplayed round with this number whole (§28).
  delete from public.run_rounds where run_id = p_run_id and number = p_number;
  if exists (select 1 from public.run_rounds where run_id = p_run_id and number = p_number) then
    raise exception 'round % has a result in it and cannot be re-paired', p_number
      using errcode = '42501';
  end if;

  insert into public.run_rounds (run_id, number, kind)
  values (p_run_id, p_number, p_kind)
  returning id into v_round_id;

  insert into public.run_pairings (round_id, run_id, table_number, p1_entrant_id, p2_entrant_id)
  select
    v_round_id,
    p_run_id,
    (pairing ->> 'table')::int,
    (pairing ->> 'p1EntrantId')::uuid,
    (pairing ->> 'p2EntrantId')::uuid
  from jsonb_array_elements(p_pairings) as pairing;

  return v_round_id;
end;
$$;

revoke all on function public.post_run_round(uuid, int, public.run_round_kind, jsonb) from public, anon;
grant execute on function public.post_run_round(uuid, int, public.run_round_kind, jsonb)
  to authenticated, service_role;
