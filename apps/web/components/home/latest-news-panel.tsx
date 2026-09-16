import Link from "next/link";
import type { PostWithAuthor } from "@ps/contracts";

import { PostMeta } from "@/components/content/post-meta";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { dateAttribute, formatDate } from "@/lib/format-date";
import { postHref } from "@/lib/post-url";

/**
 * The home page's lead tile: the newest announcement in full, and the ones
 * behind it as a list.
 *
 * Not `PostList`. That component renders a feed — every post at the same weight,
 * which is what `/news` and `/articles` want and the opposite of what the top
 * left of a home page wants. The lead post here gets the excerpt and the size;
 * the rest get a date and a title.
 */
export function LatestNewsPanel({ posts }: { posts: readonly PostWithAuthor[] }) {
  const [lead, ...rest] = posts;

  if (lead === undefined) {
    return (
      <EmptyState title="No announcements yet" className="h-full">
        B&amp;R notices, season openings, and event recaps are posted here.
      </EmptyState>
    );
  }

  return (
    <Card className="group/panel flex h-full flex-col transition-colors hover:border-eclipse-500/60 dark:hover:border-eclipse-500/60">
      <article className="relative flex flex-1 flex-col p-6 sm:p-7">
        <PostMeta post={lead} showKind={false} className="mb-3" />

        <h2 className="font-serif text-2xl/snug font-semibold tracking-tight text-balance sm:text-3xl/tight">
          <Link
            href={postHref(lead)}
            className="after:absolute after:inset-0 group-hover/panel:text-eclipse-700 dark:group-hover/panel:text-eclipse-400"
          >
            {lead.title}
          </Link>
        </h2>

        {lead.subtitle !== null && (
          <p className="mt-2 text-ink-600 dark:text-ink-400">{lead.subtitle}</p>
        )}

        {lead.excerpt !== null && (
          <p className="mt-4 text-[15px]/6.5 text-ink-700 dark:text-ink-300">{lead.excerpt}</p>
        )}

        {/* Pushed to the bottom so the tile squares up against the event tile
            beside it however long the excerpt runs. */}
        {rest.length > 0 && (
          <ul className="mt-auto space-y-px pt-6">
            {rest.map((post) => (
              <li key={post.id}>
                {/* `relative` and a z-index: the lead's stretched link covers the
                    whole card, and these sit on top of it or they are unclickable. */}
                <Link
                  href={postHref(post)}
                  className="relative z-10 -mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2 hover:bg-ink-100/70 dark:hover:bg-ink-800/60"
                >
                  <span className="text-sm/snug font-medium">{post.title}</span>
                  {post.publishedAt !== null && (
                    <time
                      dateTime={dateAttribute(post.publishedAt)}
                      className="shrink-0 text-xs text-ink-500 tabular-nums dark:text-ink-400"
                    >
                      {formatDate(post.publishedAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* Outside the article, or the lead's stretched link swallows it. */}
      <div className="relative z-10 border-t border-ink-200 px-6 py-3 text-sm dark:border-ink-800 sm:px-7">
        <Link
          href="/news"
          className="font-medium text-ink-600 hover:text-eclipse-700 dark:text-ink-400 dark:hover:text-eclipse-400"
        >
          All announcements →
        </Link>
      </div>
    </Card>
  );
}
