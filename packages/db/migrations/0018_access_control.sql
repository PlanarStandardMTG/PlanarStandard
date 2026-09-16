-- E14.3, E14.4 — organizer-gated and admin-only writes.
--
-- Every table already carries its public read policy, shipped with the migration
-- that created it. What none of them carried is a *write* policy, which means
-- anon and authenticated could write nothing anywhere. That is the right default
-- and it stays the default here: this migration opens specific doors and leaves
-- everything else shut.
--
-- Three things are deliberately still shut:
--
--   Derived tables — every `*_stats`, `deck_metrics`, `deck_similarity`,
--   `player_ratings`, `rating_events`, `rating_runs` — take no writes from
--   anybody. They are recomputed wholesale by a job running as service-role,
--   which bypasses RLS entirely, and ADR 008 says a derived statistic is never
--   uploaded. A policy here would be a way to upload one (E14.2).
--
--   `posts`, `post_revisions` and `decks` take no writes yet either. Their write
--   paths are E20.2 and E20.7, and a policy written now would be a guess at a
--   flow that does not exist.
--
--   `external_event_syncs` keeps no policy at all, including for reads: it is the
--   calendar request budget, spent by the server.

/*
 * The caller's rung on the role ladder.
 *
 * `security definer` for two reasons, and only the second is obvious. It reads
 * `profiles`, which has RLS — and a policy on `profiles` that called this would
 * recurse forever. Running as the owner takes the inner read out of RLS and
 * settles both.
 *
 * `stable`, so the planner may call it once per statement rather than once per
 * row. On a table scan the difference is the whole cost of the policy.
 *
 * **This ladder is also in `core/auth/meets-role`**, because a route guard
 * cannot ask Postgres and a policy cannot ask TypeScript. Two copies of one
 * rule is a thing to be nervous about, so `rls.test.ts` asserts the two agree
 * across every pair — the same way `generated-columns.test.ts` pins the SQL and
 * TypeScript halves of `normalize-handle` to one fixture.
 */
create function public.role_rank(r public.user_role) returns int
language sql
immutable
as $$
  select case r
    when 'admin' then 3
    when 'organizer' then 2
    when 'writer' then 1
    else 0
  end;
$$;

create function public.has_role(required public.user_role) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.role_rank(p.role) >= public.role_rank(required)
      from public.profiles p
      where p.user_id = auth.uid()
    ),
    false
  );
$$;

-- Readable by anyone signed in, and by the server. It answers only about the
-- caller, so there is nothing here to point at somebody else.
revoke all on function public.has_role(public.user_role) from public;
grant execute on function public.has_role(public.user_role) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E14.4 — admin only
-- ---------------------------------------------------------------------------

-- Format authority is data, not code: a B&R announcement must never need a pull
-- request (§21, ADR notes). These four are what an admin edits instead.
create policy format_versions_admin_write on format_versions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy format_legal_sets_admin_write on format_legal_sets
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy format_card_rules_admin_write on format_card_rules
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy format_constraints_admin_write on format_constraints
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy seasons_admin_write on seasons
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- The archetype vocabulary, for the same reason.
create policy archetypes_admin_write on archetypes
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy archetype_aliases_admin_write on archetype_aliases
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Rating constants. Changing one re-rates the whole season on the next run, so
-- this is as consequential as a ban.
create policy rating_config_admin_write on rating_config
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Identity curation (ADR 009). These three have no read policy either — a
-- suggested merge names two handles somebody thinks are one person, which is a
-- guess about a real player and not something to publish while it is a guess.
create policy merge_suggestions_admin_all on merge_suggestions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy player_merges_admin_all on player_merges
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy identity_exclusions_admin_all on identity_exclusions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

/*
 * Role grants.
 *
 * The one thing `profiles_self_update` refuses. Permissive policies are ORed, so
 * an admin has both this and the self-update policy — which is what lets an
 * admin change a role while everybody else still cannot change their own.
 *
 * `has_role` is `security definer`, so reading `profiles` from inside a policy
 * on `profiles` does not recurse.
 */
create policy profiles_admin_update on profiles
  for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------------
-- E14.3 — organizer and up
-- ---------------------------------------------------------------------------

-- An organizer creates the event and imports its results. Admins inherit this,
-- and everybody else is left with the public read the table already had.
create policy tournaments_organizer_write on tournaments
  for all to authenticated
  using (public.has_role('organizer'))
  with check (public.has_role('organizer'));

-- The import pipeline's own tables. No public read: a staged row is a parse in
-- progress, full of unresolved handles and errors, and publishing it would show
-- the community a half-read tournament as though it were a result.
create policy result_imports_organizer_all on result_imports
  for all to authenticated
  using (public.has_role('organizer'))
  with check (public.has_role('organizer'));

create policy staged_matches_organizer_all on staged_matches
  for all to authenticated
  using (public.has_role('organizer'))
  with check (public.has_role('organizer'));

-- The ledger itself. `matches` and `tournament_entries` are already publicly
-- readable; this is what lets an organizer's import commit into them.
--
-- Deliberately no delete for anybody: re-importing an event supersedes it
-- wholesale, and that replacement runs as service-role. An organizer who could
-- delete a match by hand could quietly change a rating (ADR 004, ADR 006).
create policy matches_organizer_write on matches
  for insert to authenticated with check (public.has_role('organizer'));

create policy tournament_entries_organizer_write on tournament_entries
  for insert to authenticated with check (public.has_role('organizer'));

-- A correction is append-only on purpose: it exists so a changed result has a
-- trail, and a trail that can be edited is not one.
create policy match_corrections_organizer_write on match_corrections
  for insert to authenticated with check (public.has_role('organizer'));

-- Players and their identities are auto-created on import (ADR 009), so an
-- organizer has to be able to make one. Merging two of them is admin work and
-- goes through `player_merges` above.
create policy players_organizer_write on players
  for all to authenticated
  using (public.has_role('organizer'))
  with check (public.has_role('organizer'));

create policy player_identities_organizer_write on player_identities
  for all to authenticated
  using (public.has_role('organizer'))
  with check (public.has_role('organizer'));
