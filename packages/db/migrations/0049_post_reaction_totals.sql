-- E20.74 — thumbs up totals for a whole feed in one call.
--
-- `post_reaction_counts` answers for one post; a feed of fifty would be fifty
-- calls. Same rules: published posts only, counts and never names.

create function public.post_reaction_totals(p_post_ids uuid[])
returns table (post_id uuid, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.post_id, count(*)
  from public.post_reactions r
  join public.posts p on p.id = r.post_id
  where r.post_id = any (p_post_ids) and p.status = 'published'
  group by r.post_id;
$$;

revoke all on function public.post_reaction_totals(uuid[]) from public;
grant execute on function public.post_reaction_totals(uuid[]) to anon, authenticated, service_role;
