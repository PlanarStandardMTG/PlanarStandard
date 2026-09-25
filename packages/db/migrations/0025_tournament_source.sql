-- E18.20 — which platform event a tournament came from, so ingesting it again
-- finds the same row instead of making a second one.
--
-- Both null for a tournament an organiser created or imported by hand; the
-- partial index only constrains the ones a platform sent. `source` takes the
-- same values as `external_events.source` and `event_completions.source`.

alter table tournaments
  add column source text,
  add column external_id text,
  add constraint tournaments_source_pair check ((source is null) = (external_id is null));

create unique index tournaments_source_external_id on tournaments (source, external_id)
  where source is not null;
