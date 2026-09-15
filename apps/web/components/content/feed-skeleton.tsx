import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/states";

import { PostListSkeleton } from "./post-list";

/**
 * The loading shape of a feed page.
 *
 * Lives under an `(index)` route group, and must stay there. A `loading.tsx`
 * wraps its whole segment *including child routes*, so at `app/news/` it would
 * also wrap `news/[slug]` — and once that boundary flushes the shell, the
 * response status is committed as 200 before the page can call `notFound()`.
 * A cross-kind or unpublished slug then renders the not-found body under a 200,
 * which search engines and link checkers both read as a real page.
 */
export function FeedSkeleton() {
  return (
    <Container className="py-12">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-10">
        <PostListSkeleton />
      </div>
    </Container>
  );
}
