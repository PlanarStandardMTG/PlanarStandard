import type { PostWithAuthor } from "@ps/contracts";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/states";
import type { Loaded } from "@/lib/load";

import { PostList } from "./post-list";

/**
 * A whole feed page. `/news` and `/community` are this component with different
 * arguments — the kinds differ editorially, not structurally.
 */
export function PostFeedPage({
  title,
  description,
  posts,
  emptyTitle,
  emptyBody,
  action,
}: {
  title: string;
  description: string;
  posts: Loaded<readonly PostWithAuthor[]>;
  emptyTitle: string;
  emptyBody: string;
  /** Beside the title — the way to add to this feed, for whoever may. */
  action?: ReactNode;
}) {
  return (
    <Container className="py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">{description}</p>
        </div>
        {action}
      </header>

      {posts.ok ? (
        <PostList
          posts={posts.value}
          // Within a single-kind feed the badge would be on every card, so it
          // says nothing. The page title already said it.
          showKind={false}
          emptyTitle={emptyTitle}
          emptyBody={emptyBody}
        />
      ) : (
        <ErrorState title="Could not load posts" detail={posts.error} />
      )}
    </Container>
  );
}
