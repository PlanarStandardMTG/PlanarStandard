import type { PostWithAuthor } from "@ps/contracts";

import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/states";
import type { Loaded } from "@/lib/load";

import { PostList } from "./post-list";

/**
 * A whole feed page. `/news` and `/articles` are this component with different
 * arguments — the kinds differ editorially, not structurally.
 */
export function PostFeedPage({
  title,
  description,
  posts,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  description: string;
  posts: Loaded<readonly PostWithAuthor[]>;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <Container className="py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">{description}</p>
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
