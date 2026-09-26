import { REVIEWER_ROLE } from "@ps/core";
import { listPostsAwaitingReview } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { PostBody } from "@/components/content/post-body";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { reviewSubmission } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  approve: "Approved and published.",
  reject: "Sent back to its author as a draft.",
};

const ERRORS: Readonly<Record<string, string>> = {
  invalid: "That review could not be read. Try again.",
  gone: "Somebody else reviewed that one first.",
};

/**
 * Members' submissions waiting for a writer or above (E20.22).
 *
 * Oldest first, so nothing waits behind newer work. The body is shown in full
 * because an unpublished post has no public page to read it on.
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(REVIEWER_ROLE);
  const { done, error } = await searchParams;

  const supabase = await createSessionClient();
  const queue = await listPostsAwaitingReview(supabase);

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Review queue</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Submissions waiting for approval. Approving one publishes it under its author&rsquo;s
          name; sending one back returns it to them as a draft.
        </p>
      </header>

      {typeof done === "string" && DONE[done] !== undefined && (
        <Notice tone="good">{DONE[done]}</Notice>
      )}
      {typeof error === "string" && ERRORS[error] !== undefined && (
        <Notice tone="warn">{ERRORS[error]}</Notice>
      )}

      <div className="mt-6">
        {queue.length === 0 ? (
          <EmptyState title="Nothing waiting">Every submission has been reviewed.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {queue.map((post) => (
              <li key={post.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-semibold">{post.title}</h2>
                      <p className="text-sm text-ink-500 dark:text-ink-400">
                        {post.author.displayName} · submitted {formatDate(post.createdAt)}
                      </p>
                    </div>
                    <form action={reviewSubmission} className="flex shrink-0 gap-2">
                      <input type="hidden" name="id" value={post.id} />
                      <button
                        type="submit"
                        name="decision"
                        value="approve"
                        className="cursor-pointer rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="reject"
                        className="cursor-pointer rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900"
                      >
                        Send back
                      </button>
                    </form>
                  </div>
                  {post.excerpt !== null && (
                    <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">{post.excerpt}</p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-eclipse-700 dark:text-eclipse-400">
                      Read it
                    </summary>
                    <div className="mt-3 border-t border-ink-200 pt-3 dark:border-ink-800">
                      <PostBody markdown={post.bodyMarkdown} />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
