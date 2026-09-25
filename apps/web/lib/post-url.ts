import type { PostKind } from "@ps/contracts";

/**
 * Where a post lives.
 *
 * The two kinds get two URL prefixes rather than one shared `/posts/`, because
 * the distinction is the point: a reader should be able to tell an announcement
 * from a member's opinion piece before clicking, and from the link alone.
 */
export function postHref(post: { slug: string; kind: PostKind }): string {
  return `${feedHref(post.kind)}/${post.slug}`;
}

export function feedHref(kind: PostKind): string {
  return kind === "official" ? "/news" : "/community";
}

export const FEED_LABEL: Record<PostKind, string> = {
  official: "News",
  community: "Community",
};
