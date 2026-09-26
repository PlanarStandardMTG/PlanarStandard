-- E18.16 — a merge can be undone, and the audit row says so.
--
-- Undoing moves back exactly the rows `moved` lists and clears the loser's
-- `merged_into`. The row stays, stamped, so the history still shows that the
-- merge happened and who took it back.

alter table player_merges
  add column undone_at timestamptz,
  add column undone_by uuid references profiles (id);
