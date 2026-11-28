-- E26.36 — an open-decklist event: once it starts, anyone who can see the event reads
-- every entrant's list (§28). Until then lists stay private, so nobody builds against them.

alter table tournament_runs add column open_decklists boolean not null default false;

grant insert (open_decklists) on tournament_runs to authenticated;
grant update (open_decklists) on tournament_runs to authenticated;

create policy run_entrant_decks_open_read on run_entrant_decks
  for select using (
    exists (
      select 1
      from public.run_entrants e
      join public.tournament_runs r on r.id = e.run_id
      where e.id = entrant_id
        and r.open_decklists
        and r.state in ('running', 'top_cut', 'finished')
    )
  );
