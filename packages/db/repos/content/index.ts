import type { PostId, PostKind, PostStatus, PostWithAuthor, ProfileId } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { POST_COLUMNS, toPostWithAuthor, type PostRow } from "./rows";

/**
 * Reads and writes over `posts` and `post_revisions`.
 *
 * Every function here answers one question the site actually asks. There is no
 * generic query function on purpose: the day a caller needs a different filter,
 * it gets a named function, not a parameter that lets any caller ask anything.
 *
 * Published-only is enforced by RLS as well as by these filters. The filters are
 * here so the intent is readable without going to the migration, not because the
 * policy is optional.
 */

/**
 * Newest published posts of either kind — one combined feed.
 *
 * Nothing calls this today: the home page went to two kind-scoped reads at E24.2
 * so that a post could not appear in both the news tile and the community list.
 * Kept because a combined feed is a reasonable thing to want again, and because
 * it is the read the RLS test for "published only" exercises most directly.
 */
export async function listRecentPublishedPosts(
  client: SupabaseClient,
  limit: number,
): Promise<readonly PostWithAuthor[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listRecentPublishedPosts failed: ${error.message}`);
  return (data as unknown as PostRow[]).map(toPostWithAuthor);
}

/** Newest published posts of one kind — the /news and /articles feeds. */
export async function listPublishedPostsByKind(
  client: SupabaseClient,
  kind: PostKind,
  limit: number,
): Promise<readonly PostWithAuthor[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("status", "published")
    .eq("kind", kind)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listPublishedPostsByKind failed: ${error.message}`);
  return (data as unknown as PostRow[]).map(toPostWithAuthor);
}

/** One published post. Null when the slug is unknown or the post is not published. */
export async function getPublishedPostBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<PostWithAuthor | null> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error !== null) throw new Error(`getPublishedPostBySlug failed: ${error.message}`);
  return data === null ? null : toPostWithAuthor(data as unknown as PostRow);
}

/** Slugs and kinds of every published post — what the router pre-renders. */
export async function listPublishedPostSlugs(
  client: SupabaseClient,
): Promise<readonly { slug: string; kind: PostKind }[]> {
  const { data, error } = await client.from("posts").select("slug, kind").eq("status", "published");

  if (error !== null) throw new Error(`listPublishedPostSlugs failed: ${error.message}`);
  return data as { slug: string; kind: PostKind }[];
}

/**
 * Everything one person has written, at any status (E16.11).
 *
 * The only read here that is not published-only, and deliberately so: this
 * answers a subject access request, where a draft somebody never finished is
 * still theirs and still has to be handed over. It is never a feed — the caller
 * is the export, and the author id comes from the session rather than a route.
 */
export async function listPostsByAuthor(
  client: SupabaseClient,
  authorId: ProfileId,
): Promise<readonly PostWithAuthor[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (error !== null) throw new Error(`listPostsByAuthor failed: ${error.message}`);
  return (data as unknown as PostRow[]).map(toPostWithAuthor);
}

/** What an author supplies. Status is decided by the caller from the author's role. */
export interface NewPost {
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly excerpt: string | null;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
  readonly status: Extract<PostStatus, "draft" | "review" | "published">;
  readonly kind: PostKind;
  readonly authorId: ProfileId;
}

/**
 * Submit a post (E14.6).
 *
 * Under the author's own client, so `posts_author_insert` decides whether the
 * status is theirs to choose — a reader asking for `published` is refused by
 * the database, whatever the caller computed. `published_at` is stamped by the
 * `posts_guard_write` trigger.
 */
export async function createPost(client: SupabaseClient, post: NewPost): Promise<PostWithAuthor> {
  const { data, error } = await client
    .from("posts")
    .insert({
      slug: post.slug,
      title: post.title,
      subtitle: post.subtitle,
      excerpt: post.excerpt,
      body_markdown: post.bodyMarkdown,
      tags: post.tags,
      status: post.status,
      kind: post.kind,
      author_id: post.authorId,
    })
    .select(POST_COLUMNS)
    .single();

  if (error !== null) throw new Error(`createPost failed: ${error.message}`);
  return toPostWithAuthor(data as unknown as PostRow);
}

/** The review queue, oldest first so nothing waits behind newer work. */
export async function listPostsAwaitingReview(
  client: SupabaseClient,
): Promise<readonly PostWithAuthor[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("status", "review")
    .order("created_at", { ascending: true });

  if (error !== null) throw new Error(`listPostsAwaitingReview failed: ${error.message}`);
  return (data as unknown as PostRow[]).map(toPostWithAuthor);
}

/**
 * Move a post out of the queue — to `published`, or back to its author as a
 * `draft` — through `review_post` (migration 0019), which checks the caller is
 * a writer or above. Only a post still in `review` matches, so two reviewers
 * acting at once cannot both win; the second is told so.
 */
export async function reviewPost(
  client: SupabaseClient,
  id: PostId,
  status: Extract<PostStatus, "published" | "draft">,
): Promise<void> {
  const { data, error } = await client.rpc("review_post", { post_id: id, outcome: status });

  if (error !== null) throw new Error(`reviewPost failed: ${error.message}`);
  if (data !== true) throw new Error(`reviewPost failed: post ${id} is not awaiting review`);
}

/**
 * One post, at any status, for its author to edit (E20.2).
 *
 * No author filter: RLS answers only with a post the caller wrote, or one in
 * the review queue for a writer — the page then checks it is the caller's own.
 */
export async function getPostForEditing(
  client: SupabaseClient,
  id: PostId,
): Promise<PostWithAuthor | null> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error !== null) throw new Error(`getPostForEditing failed: ${error.message}`);
  return data === null ? null : toPostWithAuthor(data as unknown as PostRow);
}

/** What an author may change. Slug, kind and author are fixed once the post exists. */
export type PostEdit = Omit<NewPost, "slug" | "kind" | "authorId">;

/**
 * Save an author's edits. Under their own client, so `posts_author_update`
 * decides — a reader cannot edit a published post or publish one here either.
 */
export async function updatePost(
  client: SupabaseClient,
  id: PostId,
  edit: PostEdit,
): Promise<PostWithAuthor> {
  const { data, error } = await client
    .from("posts")
    .update({
      title: edit.title,
      subtitle: edit.subtitle,
      excerpt: edit.excerpt,
      body_markdown: edit.bodyMarkdown,
      tags: edit.tags,
      status: edit.status,
    })
    .eq("id", id)
    .select(POST_COLUMNS)
    .single();

  if (error !== null) throw new Error(`updatePost failed: ${error.message}`);
  return toPostWithAuthor(data as unknown as PostRow);
}
