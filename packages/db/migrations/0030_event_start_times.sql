-- E23.15 — a start time an admin types in, for calendars that do not send one.
--
-- melee.gg's API carries no start time, so its events arrive undated. The
-- admin's time lives in its own column because the refresh rewrites
-- `starts_at` wholesale from the payload (E23.6): kept there, it would be
-- wiped by the next fetch. The upsert never names this column, so it survives.
-- Where both are set, the admin's wins — it is the correction.

alter table external_events add column starts_at_manual timestamptz;
