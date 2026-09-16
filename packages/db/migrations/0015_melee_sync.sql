-- melee.gg joins the calendar (E23.12).
--
-- A ledger row is the right to spend a request against a source, which is why
-- 0003 created one for Challonge and not for melee.gg: nothing fetched melee.gg,
-- and a row would have claimed a budget against a client that did not exist.
-- `apps/web/lib/melee/client.server.ts` is that client, so the row is earned.
--
-- Both timestamps stay null. A source that has never been attempted is always
-- due (`core/events/sync-window`), so the first page render after this deploys
-- refreshes melee.gg rather than waiting out an interval it never spent.
insert into external_event_syncs (source) values ('melee')
  on conflict (source) do nothing;
