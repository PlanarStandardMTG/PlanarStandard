-- E20.33 — an admin creates, edits and deletes format versions from the site.
--
-- The four `format_*` tables already have admin write policies (E14.4); what
-- they lack is a way to write one version as a unit. Both functions here are
-- security invoker, so those policies still decide who may call them.

/*
 * Create (`format_version_id` null) or replace one version with its legal sets,
 * constraints and card rules, in one transaction. Returns the version's id.
 *
 * Making a version current un-marks the old one first: `format_versions_one_current`
 * is a partial unique index, so the two updates have to be in that order.
 * `extra_rules` is left as it is on an existing version — nothing edits it yet.
 *
 * `draft` is `{ name, effective_from, effective_to, notes_markdown, is_current,
 * legal_sets: text[], constraints: { min_maindeck, max_maindeck, max_sideboard,
 * max_copies, singleton }, card_rules: [{ oracle_id, ruling, reason,
 * effective_from }] }`.
 */
create function public.save_format_version(format_version_id uuid, draft jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  version_id uuid := save_format_version.format_version_id;
  current boolean := coalesce((draft ->> 'is_current')::boolean, false);
begin
  if current then
    update public.format_versions set is_current = false
    where is_current and id is distinct from version_id;
  end if;

  if version_id is null then
    insert into public.format_versions (name, effective_from, effective_to, notes_markdown, is_current)
    values (
      draft ->> 'name',
      (draft ->> 'effective_from')::date,
      (draft ->> 'effective_to')::date,
      draft ->> 'notes_markdown',
      current
    )
    returning id into version_id;
  else
    update public.format_versions set
      name = draft ->> 'name',
      effective_from = (draft ->> 'effective_from')::date,
      effective_to = (draft ->> 'effective_to')::date,
      notes_markdown = draft ->> 'notes_markdown',
      is_current = current
    where id = version_id;
    if not found then
      raise exception 'no format version %', version_id using errcode = 'no_data_found';
    end if;
  end if;

  delete from public.format_legal_sets s where s.format_version_id = version_id;
  insert into public.format_legal_sets (format_version_id, set_code)
  select version_id, code from jsonb_array_elements_text(draft -> 'legal_sets') as code;

  insert into public.format_constraints (
    format_version_id, min_maindeck, max_maindeck, max_sideboard, max_copies, singleton
  )
  select version_id, c.min_maindeck, c.max_maindeck, c.max_sideboard, c.max_copies, c.singleton
  from jsonb_to_record(draft -> 'constraints') as c(
    min_maindeck int, max_maindeck int, max_sideboard int, max_copies int, singleton boolean
  )
  on conflict (format_version_id) do update set
    min_maindeck = excluded.min_maindeck,
    max_maindeck = excluded.max_maindeck,
    max_sideboard = excluded.max_sideboard,
    max_copies = excluded.max_copies,
    singleton = excluded.singleton;

  delete from public.format_card_rules r where r.format_version_id = version_id;
  insert into public.format_card_rules (format_version_id, oracle_id, ruling, reason, effective_from)
  select version_id, r.oracle_id, r.ruling, r.reason, r.effective_from
  from jsonb_to_recordset(draft -> 'card_rules') as r(
    oracle_id uuid, ruling public.card_ruling, reason text, effective_from date
  );

  return version_id;
end;
$$;

revoke all on function public.save_format_version(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_format_version(uuid, jsonb) to authenticated, service_role;

/*
 * Delete a version that is not current, with its sets, constraints and card
 * rules. A version a season, tournament or deck names fails on that foreign
 * key: those records were checked against it, and deleting it would leave them
 * pointing at nothing.
 */
create function public.delete_format_version(format_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.format_versions v
    where v.id = delete_format_version.format_version_id and v.is_current
  ) then
    raise exception 'the current format version cannot be deleted' using errcode = 'check_violation';
  end if;

  delete from public.format_versions v where v.id = delete_format_version.format_version_id;
end;
$$;

revoke all on function public.delete_format_version(uuid) from public, anon, authenticated;
grant execute on function public.delete_format_version(uuid) to authenticated, service_role;
