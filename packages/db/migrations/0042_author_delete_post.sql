-- E20.47 — an author deletes their own post, at any status.
--
-- Until now only `admin_delete_post` (0033) removed a post. Reactions and
-- revisions cascade. A banned member clears no rung of `has_role`, so a ban
-- also stops them deleting.

create policy posts_author_delete on posts for delete to authenticated
  using (author_id = public.current_profile_id() and public.has_role('reader'));
