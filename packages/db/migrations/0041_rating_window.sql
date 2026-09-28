-- The dates Elo replays (E25.6), both inclusive, in place of "the current
-- season". An admin sets them at /admin/processing; a null end runs to the
-- newest event. Starts where the current season does, so the next recompute
-- rates what the last one did.

alter table rating_config
  add column rated_from date,
  add column rated_until date;

update rating_config
set rated_from = coalesce(
      (select starts_on from seasons where is_current),
      (select min(starts_on) from seasons),
      current_date
    ),
    rated_until = (select ends_on from seasons where is_current)
where id = 1;

alter table rating_config
  alter column rated_from set not null,
  alter column rated_from set default current_date,
  add constraint rating_window_in_order check (rated_until is null or rated_until >= rated_from);
