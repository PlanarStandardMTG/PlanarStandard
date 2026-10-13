import type { PostKind } from "@ps/contracts";
import Link from "next/link";

import { EditorFor } from "@/components/content/editor-page";
import { requireRole } from "@/lib/auth/guard";
import { ownPostsHref } from "@/lib/post-url";

/**
 * A blank community post (E20.2), or a news post — admin-only, like the policy
 * underneath. Nothing is written until the first save.
 */
export async function NewPostPage({ kind }: { kind: PostKind }) {
  const official = kind === "official";
  const viewer = await requireRole(official ? "admin" : "reader");

  return (
    <>
      <header className="mb-6">
        <Link
          href={ownPostsHref(kind)}
          className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          <span aria-hidden="true">←</span> Your {official ? "news" : "community"} posts
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
          {official ? "New news post" : "New community post"}
        </h1>
        {official && (
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            Published under the format&rsquo;s name, at <code>/news</code>.
          </p>
        )}
      </header>

      <EditorFor
        authorId={viewer.profile.id}
        id={null}
        kind={kind}
        slug=""
        status={null}
        role={viewer.profile.role}
        initial={{ title: "", subtitle: "", excerpt: "", tags: "", bodyMarkdown: "" }}
      />
    </>
  );
}
