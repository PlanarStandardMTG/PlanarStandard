-- E20.25 — where a post's uploaded images live.
--
-- A public Supabase Storage bucket: a published post's images must load for
-- anyone, and a public bucket serves them by URL without a read policy. Writes
-- are a member's own, into a folder named by their user id, so nobody can
-- overwrite or delete another author's picture. The size and type limits are
-- enforced by Storage itself; 4 MB leaves room under Vercel's 4.5 MB request
-- cap, which the upload passes through on its way here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy post_images_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy post_images_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
