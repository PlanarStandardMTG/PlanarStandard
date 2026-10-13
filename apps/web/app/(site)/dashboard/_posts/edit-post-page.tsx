import type { PostKind } from "@ps/contracts";
import { canEditOwnPost } from "@ps/core";
import { getPostForEditing } from "@ps/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Notice } from "@/components/auth/form-parts";
import { EditorFor } from "@/components/content/editor-page";
import { requireRole } from "@/lib/auth/guard";
import { editPostHref, ownPostsHref, postHref } from "@/lib/post-url";
import { createSessionClient } from "@/lib/supabase/session";

const SAVED: Readonly<Record<string, string>> = {
  draft: "Draft saved.",
  review: "Submitted. It will go live once a writer or an admin approves it.",
  published: "Saved, and live.",
};

/**
 * One of the author's own posts (E20.2). Somebody else's is a 404 rather than
 * a refusal: RLS already hides other members' drafts, and a writer who can see
 * the review queue edits nothing from here. Under the other kind's prefix it
 * moves to its own (E20.47).
 */
export async function EditPostPage({
  kind,
  params,
  searchParams,
}: {
  kind: PostKind;
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole("reader");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);

  const post = await getPostForEditing(await createSessionClient(), id);
  if (post === null || post.authorId !== viewer.profile.id) notFound();
  if (post.kind !== kind) redirect(editPostHref(post));

  const editable = canEditOwnPost(post.status, viewer.profile.role);

  return (
    <>
      <header className="mb-6">
        <Link
          href={ownPostsHref(kind)}
          className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          <span aria-hidden="true">←</span> Your {kind === "official" ? "news" : "community"} posts
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Edit post</h1>
        {post.status === "published" && (
          <Link
            href={postHref(post)}
            className="mt-1 inline-block text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            View it on the site
          </Link>
        )}
      </header>

      {typeof saved === "string" && SAVED[saved] !== undefined && (
        <div className="mb-6">
          <Notice tone="good">{SAVED[saved]}</Notice>
        </div>
      )}

      {editable ? (
        <EditorFor
          authorId={viewer.profile.id}
          id={post.id}
          kind={post.kind}
          slug={post.slug}
          status={post.status}
          role={viewer.profile.role}
          initial={{
            title: post.title,
            subtitle: post.subtitle ?? "",
            excerpt: post.excerpt ?? "",
            tags: post.tags.join(", "),
            bodyMarkdown: post.bodyMarkdown,
          }}
        />
      ) : (
        <Notice tone="warn">
          This post has been published. Only a writer can change it now — ask one if something needs
          correcting.
        </Notice>
      )}
    </>
  );
}
