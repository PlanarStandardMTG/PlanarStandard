import type { PostWithAuthor } from "@ps/contracts";

import { cn } from "@/lib/cn";
import { dateAttribute, formatDate } from "@/lib/format-date";

import { PostKindBadge } from "./post-kind-badge";

/**
 * Byline, date, and kind. Used by the card in a feed and by the article header,
 * so the two can never drift into disagreeing about what a post is.
 */
export function PostMeta({
  post,
  className,
  showKind = true,
}: {
  post: PostWithAuthor;
  className?: string;
  showKind?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-ink-500 dark:text-ink-400",
        className,
      )}
    >
      {showKind && <PostKindBadge kind={post.kind} />}
      <span className="font-medium text-ink-700 dark:text-ink-300">{post.author.displayName}</span>
      {post.publishedAt !== null && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={dateAttribute(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
        </>
      )}
    </div>
  );
}
