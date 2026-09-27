-- E20.41 — reactions on published posts.
--
-- One reaction per member per post, which they can change or take back. Who
-- reacted is theirs: a member reads only their own rows, and everybody else sees
-- the tallies through `post_reaction_counts`. Reacting is a write a role grants,
-- so a banned member cannot (E14.7).

create type post_reaction as enum ('thumbs_up', 'white', 'blue', 'black', 'red', 'green');

create table post_reactions (
  post_id uuid not null references posts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  reaction post_reaction not null,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

comment on table post_reactions is
  'One reaction per member per published post. Read your own; tallies come from post_reaction_counts.';

alter table post_reactions enable row level security;

create policy post_reactions_own_select on post_reactions
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy post_reactions_own_insert on post_reactions
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and public.has_role('reader')
    and exists (select 1 from posts p where p.id = post_id and p.status = 'published')
  );

create policy post_reactions_own_update on post_reactions
  for update to authenticated
  using (profile_id = public.current_profile_id() and public.has_role('reader'))
  with check (profile_id = public.current_profile_id() and public.has_role('reader'));

create policy post_reactions_own_delete on post_reactions
  for delete to authenticated
  using (profile_id = public.current_profile_id() and public.has_role('reader'));

/*
 * How many of each reaction a published post has. `security definer` so a
 * visitor can count rows they may not read; it returns no names.
 */
create function public.post_reaction_counts(p_post_id uuid)
returns table (reaction public.post_reaction, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.reaction, count(*)
  from public.post_reactions r
  join public.posts p on p.id = r.post_id
  where r.post_id = p_post_id and p.status = 'published'
  group by r.reaction;
$$;

revoke all on function public.post_reaction_counts(uuid) from public;
grant execute on function public.post_reaction_counts(uuid) to anon, authenticated, service_role;
