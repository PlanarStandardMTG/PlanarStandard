import type { PostKind, PostStatus } from "@ps/contracts";
import { canEditOwnPost, submissionStatus } from "@ps/core";
import { listPostsByAuthor } from "@ps/db";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { WritePostButton } from "@/components/content/write-post-button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { editPostHref, postHref } from "@/lib/post-url";
import { createSessionClient } from "@/lib/supabase/session";

import { deletePost } from "../community/actions";

const STATUS: Readonly<Record<PostStatus, { label: string; variant: BadgeVariant }>> = {
  draft: { label: "Draft", variant: "outline" },
  review: { label: "Awaiting review", variant: "neutral" },
  published: { label: "Published", variant: "accent" },
  archived: { label: "Archived", variant: "outline" },
};

const SMALL_BUTTON =
  "cursor-pointer whitespace-nowrap rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900";

/**
 * What the viewer has written of one kind, and a way to write more, edit or
 * delete (E20.22, E20.2, E20.47). News is an admin's, as `canWriteKind` says.
 */
export async function OwnPostsPage({
  kind,
  searchParams,
}: {
  kind: PostKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(kind === "official" ? "admin" : "reader");
  const { role } = viewer.profile;
  const [{ done, error }, posts] = await Promise.all([
    searchParams,
    createSessionClient().then((supabase) => listPostsByAuthor(supabase, viewer.profile.id)),
  ]);
  const own = posts.filter((post) => post.kind === kind);
  const news = kind === "official";

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {news ? "Your news posts" : "Your community posts"}
        </h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          {news
            ? "Published under the format’s name, at /news."
            : submissionStatus(role) === "published"
              ? `As a ${role}, what you submit is published straight away.`
              : "What you submit waits for a writer or an admin to approve it before it is published."}
        </p>
      </header>

      {done === "deleted" && (
        <div className="mb-6">
          <Notice tone="good">Post deleted.</Notice>
        </div>
      )}
      {error === "gone" && (
        <div className="mb-6">
          <Notice tone="warn">That post was already gone.</Notice>
        </div>
      )}

      <WritePostButton kind={kind} />

      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">Written</h2>
      {own.length === 0 ? (
        <EmptyState title="Nothing yet">Drafts and submissions are listed here.</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {own.map((post) => (
            <li
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0">
                {post.status === "published" ? (
                  <Link
                    href={postHref(post)}
                    className="font-medium text-ink-900 hover:underline dark:text-ink-100"
                  >
                    {post.title}
                  </Link>
                ) : (
                  <p className="font-medium">{post.title}</p>
                )}
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {formatDate(post.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={STATUS[post.status].variant}>{STATUS[post.status].label}</Badge>
                {canEditOwnPost(post.status, role) && (
                  <Link href={editPostHref(post)} className={SMALL_BUTTON}>
                    Edit
                  </Link>
                )}
                <DeleteForm id={post.id} kind={kind} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A disclosure, so the delete takes a second click and no script. */
function DeleteForm({ id, kind }: { id: string; kind: PostKind }) {
  return (
    <details className="group relative">
      <summary
        className={`${SMALL_BUTTON} list-none group-open:bg-ink-100 dark:group-open:bg-ink-900 [&::-webkit-details-marker]:hidden`}
      >
        Delete
      </summary>
      <form action={deletePost} className="absolute right-0 z-10 mt-1">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <button
          type="submit"
          className="cursor-pointer whitespace-nowrap rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
        >
          Delete post
        </button>
      </form>
    </details>
  );
}
