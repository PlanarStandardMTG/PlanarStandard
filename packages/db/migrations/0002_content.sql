-- E13.13 — posts and post_revisions.
--
-- §16 of the master plan, plus `kind`, which the plan's DDL does not carry.

-- Who a post speaks for. `official` is the format itself — B&R announcements,
-- season openings, event recaps; `community` is a member under their own byline.
-- Orthogonal to `status`, which is how far through review a post has got, and to
-- the §25 split rule, which decides repo-MDX versus database-post in the first
-- place.
create type post_kind as enum ('official', 'community');

create type post_status as enum ('draft', 'review', 'published', 'archived');

create table posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  body_markdown text not null default '',
  excerpt text,
  hero_image_url text,
  tags text[] not null default '{}',
  status post_status not null default 'draft',
  kind post_kind not null default 'community',
  author_id uuid not null references profiles (id),
  published_at timestamptz,
  reddit_url text,
  reddit_posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A published post without a date cannot be ordered, and every feed on the
  -- site orders by this column.
  constraint posts_published_has_date check (status <> 'published' or published_at is not null)
);

create table post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  title text not null,
  body_markdown text not null,
  edited_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Every feed is "published, this kind, newest first". Partial, because drafts are
-- never in a feed and there is no reason to carry them in the index.
create index posts_published_idx on posts (published_at desc) where status = 'published';
create index posts_kind_published_idx on posts (kind, published_at desc) where status = 'published';
create index post_revisions_post_idx on post_revisions (post_id, created_at desc);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

alter table posts enable row level security;
alter table post_revisions enable row level security;

-- E14.1's posts slice. A table shipped with RLS on and no policy is a table
-- nobody can read, so the public-read rule lands with the table it guards.
create policy posts_public_read on posts for select using (status = 'published');

-- Revisions are editorial history, not public record.
create policy post_revisions_author_read on post_revisions for select
  using (exists (select 1 from posts where posts.id = post_revisions.post_id and posts.author_id = auth.uid()));
