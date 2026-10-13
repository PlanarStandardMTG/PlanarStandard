-- E26.26 — a run's pages update while they are open (§28).
--
-- Supabase Realtime sends a change only for tables in this publication, and only to a
-- subscriber whose read policy would show them the row: the same RLS as a page read.
-- The play app subscribes per run, never to everything (the free plan's limits, §28).

alter publication supabase_realtime add table tournament_runs, run_entrants, run_rounds, run_pairings;
