import type { PostKind, PostWithAuthor } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { POST_COLUMNS, toPostWithAuthor, type PostRow } from "./rows";

/**
 * Reads over `posts` and `post_revisions`.
 *
 * Every function here answers one question the site actually asks. There is no
 * generic query function on purpose: the day a caller needs a different filter,
 * it gets a named function, not a parameter that lets any caller ask anything.
 *
 * Published-only is enforced by RLS as well as by these filters. The filters are
 * here so the intent is readable without going to the migration, not because the
 * policy is optional.
 */

/** Newest published posts of either kind — the home page feed. */
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
  const { data, error } = await client
    .from("posts")
    .select("slug, kind")
    .eq("status", "published");

  if (error !== null) throw new Error(`listPublishedPostSlugs failed: ${error.message}`);
  return data as { slug: string; kind: PostKind }[];
}
