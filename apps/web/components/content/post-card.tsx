import type { PostWithAuthor } from "@ps/contracts";

import { Card } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { postHref } from "@/lib/post-url";

import { PostMeta } from "./post-meta";

/**
 * One post in a feed.
 *
 * `compact` is the home page's short list; the full version adds the excerpt and
 * the tags. Same component either way — a second card component is how the two
 * start describing the same post differently.
 */
export function PostCard({
  post,
  compact = false,
  showKind = true,
  reactions,
}: {
  post: PostWithAuthor;
  compact?: boolean;
  showKind?: boolean;
  /** Its thumbs up, shown beside the post; left off when not given or none. */
  reactions?: number;
}) {
  return (
    <Card className="group transition-colors hover:border-eclipse-500/60 dark:hover:border-eclipse-500/60">
      <article className={cn("flex gap-4 p-5", compact ? "sm:p-5" : "sm:p-6")}>
        <div className="min-w-0 flex-1">
          <PostMeta post={post} showKind={showKind} className="mb-2.5" />

          <h3
            className={cn("font-bold tracking-tight", compact ? "text-base/snug" : "text-lg/snug")}
          >
            <Link
              href={postHref(post)}
              className="after:absolute after:inset-0 group-hover:text-eclipse-700 dark:group-hover:text-eclipse-400"
            >
              {post.title}
            </Link>
          </h3>

          {post.subtitle !== null && (
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{post.subtitle}</p>
          )}

          {!compact && post.excerpt !== null && (
            <p className="mt-3 text-[15px]/6 text-ink-700 dark:text-ink-300">{post.excerpt}</p>
          )}

          {!compact && post.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-400"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        {reactions !== undefined && reactions > 0 && (
          <p
            className="inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-full border border-ink-200 px-2.5 text-xs text-ink-600 tabular-nums dark:border-ink-800 dark:text-ink-300"
            aria-label={`${reactions} thumbs up`}
          >
            <span aria-hidden="true" className="leading-none">
              👍
            </span>
            <span aria-hidden="true">{reactions}</span>
          </p>
        )}
      </article>
    </Card>
  );
}
