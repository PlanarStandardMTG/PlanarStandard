import type { PostWithAuthor } from "@ps/contracts";
import { listPostReactionTotals } from "@ps/db";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/states";
import { load, type Loaded } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

import { PostList } from "./post-list";

/**
 * A whole feed page. `/news` and `/community` are this component with different
 * arguments — the kinds differ editorially, not structurally.
 */
export async function PostFeedPage({
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
  emptyBody?: string;
  /** Beside the title — the way to add to this feed, for whoever may. */
  action?: ReactNode;
}) {
  // The feed is the page; totals that fail to load are left off its cards.
  const reactions = posts.ok
    ? await load(() =>
        listPostReactionTotals(
          createPublicClient(),
          posts.value.map((post) => post.id),
        ),
      )
    : null;

  return (
    <Container className="py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
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
          {...(reactions?.ok === true ? { reactions: reactions.value } : {})}
          emptyTitle={emptyTitle}
          {...(emptyBody === undefined ? {} : { emptyBody })}
        />
      ) : (
        <ErrorState title="Could not load posts" detail={posts.error} />
      )}
    </Container>
  );
}
