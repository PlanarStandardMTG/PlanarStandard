import type { Post, PostAuthor, PostWithAuthor } from "@ps/contracts";

/**
 * The `posts` row as PostgREST returns it, with the author join.
 *
 * Kept next to the mapper rather than exported: outside this module a post is a
 * `Post`, and the snake_case shape of the table is nobody else's business.
 */
export interface PostRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly body_markdown: string;
  readonly excerpt: string | null;
  readonly hero_image_url: string | null;
  readonly tags: readonly string[] | null;
  readonly status: Post["status"];
  readonly kind: Post["kind"];
  readonly author_id: string;
  readonly published_at: string | null;
  readonly reddit_url: string | null;
  readonly reddit_posted_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly author: AuthorRow | null;
}

interface AuthorRow {
  readonly id: string;
  readonly display_name: string;
  readonly handle: string | null;
  readonly avatar_url: string | null;
}

/** The select list every query in this module uses, so they all map identically. */
export const POST_COLUMNS =
  "id, slug, title, subtitle, body_markdown, excerpt, hero_image_url, tags, status, kind, " +
  "author_id, published_at, reddit_url, reddit_posted_at, created_at, updated_at, " +
  "author:profiles!posts_author_id_fkey (id, display_name, handle, avatar_url)";

export function toPostWithAuthor(row: PostRow): PostWithAuthor {
  return { ...toPost(row), author: toAuthor(row) };
}

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    bodyMarkdown: row.body_markdown,
    excerpt: row.excerpt,
    heroImageUrl: row.hero_image_url,
    tags: row.tags ?? [],
    status: row.status,
    kind: row.kind,
    authorId: row.author_id,
    publishedAt: row.published_at,
    redditUrl: row.reddit_url,
    redditPostedAt: row.reddit_posted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * A deleted profile leaves a post with no author row. The post is still worth
 * showing, so the byline degrades rather than the page failing.
 */
function toAuthor(row: PostRow): PostAuthor {
  const author = row.author;
  if (author === null) {
    return { id: row.author_id, displayName: "Unknown author", handle: null, avatarUrl: null };
  }
  return {
    id: author.id,
    displayName: author.display_name,
    handle: author.handle,
    avatarUrl: author.avatar_url,
  };
}
