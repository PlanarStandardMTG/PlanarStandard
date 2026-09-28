-- A version's legal sets gain an order and a core flag. The order is how `/rules`
-- lists them and the tiebreak set attribution already assumed (§8.3); the core
-- sets are the ones that do not rotate, FDN so far.

alter table format_legal_sets
  add column position int,
  add column is_core boolean not null default false;

update format_legal_sets s
set position = ordered.position, is_core = s.set_code = 'FDN'
from (
  select format_version_id, set_code,
    (row_number() over (
      partition by format_version_id order by set_code <> 'FDN', set_code
    ))::int as position
  from format_legal_sets
) ordered
where ordered.format_version_id = s.format_version_id and ordered.set_code = s.set_code;

alter table format_legal_sets
  alter column position set not null,
  add constraint format_legal_sets_position_unique unique (format_version_id, position);

/*
 * `legal_sets` is now `[{ code, core }]`, in order. A bare code is still read as
 * a non-core set, so a deploy that lands after this migration keeps saving.
 */
create or replace function public.save_format_version(format_version_id uuid, draft jsonb)
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
  insert into public.format_legal_sets (format_version_id, set_code, position, is_core)
  select
    version_id,
    case jsonb_typeof(entry) when 'string' then entry #>> '{}' else entry ->> 'code' end,
    ordinality::int,
    jsonb_typeof(entry) = 'object' and coalesce((entry ->> 'core')::boolean, false)
  from jsonb_array_elements(draft -> 'legal_sets') with ordinality as e(entry, ordinality);

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
