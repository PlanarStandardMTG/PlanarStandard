-- E14.6, E14.7 — bans, and the posts write path.
--
-- Two things an admin page and an article queue need from the database, which
-- is where both rules have to live: a server action can be skipped, a policy
-- cannot.
--
--   Bans. A banned member keeps their account, their byline and their data —
--   they can still export it or erase it (E16.10, E16.11) — but they sit on no
--   rung of the ladder, so every write a role grants is shut to them.
--
--   Posts. Anyone signed in may submit. A writer's submission publishes; a
--   reader's waits in `review` until a writer or above approves it. The same
--   split is `core/content/post-workflow`, for the route guards.

alter table profiles add column banned_at timestamptz;

comment on column profiles.banned_at is
  'When an admin banned this member, or null. A banned member clears no rung of the ladder.';

/*
 * `has_role`, now false for a banned caller at every rung — `reader` included,
 * which is what makes `has_role('reader')` mean "a member in good standing".
 * Same signature, so every policy that already calls it tightens with no edit.
 */
create or replace function public.has_role(required public.user_role) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.role_rank(p.role) >= public.role_rank(required)
      from public.profiles p
      where p.user_id = auth.uid() and p.banned_at is null
    ),
    false
  );
$$;

/*
 * The caller's profile id. Not the auth id: since E16.10 the two are separate
 * columns, and `posts.author_id` points at the profile.
 *
 * Deliberately blind to bans, so a banned member can still read their own
 * drafts — the export depends on it. Writes check `has_role` as well.
 */
create function public.current_profile_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid();
$$;

revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E14.7 — bans and role grants
-- ---------------------------------------------------------------------------

-- A banned member may not edit their profile — a display name is public, and
-- is the first thing somebody banned for abuse would reach for. Nobody may
-- change their own ban or their own role.
drop policy profiles_self_update on profiles;

create policy profiles_self_update on profiles
  for update using (user_id = auth.uid() and banned_at is null)
  with check (
    user_id = auth.uid()
    and banned_at is null
    and role = (select role from profiles where user_id = auth.uid())
  );

-- An admin acts on everybody but themselves. That is what keeps the site from
-- ever having no admin: the one making the change always survives it.
-- `user_id <> auth.uid()` is also null, so false, for a tombstone — there is
-- nobody left there to promote or ban.
drop policy profiles_admin_update on profiles;

create policy profiles_admin_update on profiles
  for update to authenticated
  using (public.has_role('admin') and user_id <> auth.uid())
  with check (public.has_role('admin') and user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- E14.6 — posts
-- ---------------------------------------------------------------------------

-- A member reads everything they have written, at any status.
create policy posts_author_read on posts for select to authenticated
  using (author_id = public.current_profile_id());

-- The review queue: writers and above see what is waiting. Moving a post out
-- of it is `review_post`, below.
create policy posts_reviewer_read on posts for select to authenticated
  using (status = 'review' and public.has_role('writer'));

-- `official` is the format's own voice (the `post_kind` comment), so only an
-- admin writes one. `published` straight from the author is a writer's right.
create policy posts_author_insert on posts for insert to authenticated
  with check (
    author_id = public.current_profile_id()
    and public.has_role('reader')
    and (status in ('draft', 'review') or (status = 'published' and public.has_role('writer')))
    and (kind = 'community' or public.has_role('admin'))
  );

-- A reader edits a post only while it is unpublished; editing a published one
-- would skip the review that published it.
create policy posts_author_update on posts for update to authenticated
  using (
    author_id = public.current_profile_id()
    and public.has_role('reader')
    and (status in ('draft', 'review') or public.has_role('writer'))
  )
  with check (
    author_id = public.current_profile_id()
    and public.has_role('reader')
    and (status in ('draft', 'review') or (status = 'published' and public.has_role('writer')))
    and (kind = 'community' or public.has_role('admin'))
  );

/*
 * Approve (→ published) or send back (→ draft), and nothing else.
 *
 * A function rather than an update policy, for two reasons. A rejected post
 * becomes a draft only its author may read, and PostgREST's update reads the
 * row back — so a reviewer's rejection would be refused after the fact. And a
 * policy would let a reviewer change any column of somebody else's post; this
 * changes one.
 */
create function public.review_post(post_id uuid, outcome public.post_status) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('writer') then
    raise exception 'reviewing a post needs a writer or above' using errcode = '42501';
  end if;
  if outcome not in ('published', 'draft') then
    raise exception 'a review publishes a post or returns it to draft' using errcode = '22023';
  end if;

  update public.posts set status = outcome where id = post_id and status = 'review';
  return found;
end;
$$;

-- By name: Supabase's default privileges grant every new function to anon and
-- authenticated, and `from public` does not take those back (E16.10).
revoke all on function public.review_post(uuid, public.post_status) from public, anon, authenticated;
grant execute on function public.review_post(uuid, public.post_status) to authenticated, service_role;

/*
 * What a policy cannot say, because `with check` sees only the new row: the
 * author never changes, so a reviewer cannot publish somebody's post under
 * their own name. And publishing stamps the date, so nobody has to remember
 * `posts_published_has_date`.
 */
create function public.guard_post_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.author_id is distinct from old.author_id then
    raise exception 'a post''s author does not change' using errcode = '42501';
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger posts_guard_write before insert or update on posts
  for each row execute function public.guard_post_write();
