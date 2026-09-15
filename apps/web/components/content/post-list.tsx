import type { PostWithAuthor } from "@ps/contracts";

import { EmptyState, Skeleton } from "@/components/ui/states";

import { PostCard } from "./post-card";

/**
 * A feed of posts, and the only component that decides what an empty feed looks
 * like. The home page, `/news`, and `/articles` all render through here.
 */
export function PostList({
  posts,
  compact = false,
  showKind = true,
  emptyTitle = "Nothing here yet",
  emptyBody,
}: {
  posts: readonly PostWithAuthor[];
  compact?: boolean;
  showKind?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>;
  }

  return (
    <ul className="grid gap-4">
      {posts.map((post) => (
        <li key={post.id} className="relative">
          <PostCard post={post} compact={compact} showKind={showKind} />
        </li>
      ))}
    </ul>
  );
}

/** Matches `PostList`'s shape so the page does not jump when the data lands. */
export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
