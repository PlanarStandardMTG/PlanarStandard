import type { Metadata } from "next";
import Link from "next/link";

import { EditorFor } from "@/components/content/editor-page";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New post",
  robots: { index: false, follow: false },
};

/**
 * A blank community post (E20.2), or with `?kind=official` a news post — admin-only,
 * like the policy underneath. Nothing is written until the first save.
 */
export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const official = (await searchParams)["kind"] === "official";
  const viewer = await requireRole(official ? "admin" : "reader");

  return (
    <>
      <header className="mb-6">
        <Link
          href="/dashboard/community"
          className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          <span aria-hidden="true">←</span> Your community posts
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
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
        kind={official ? "official" : "community"}
        slug=""
        status={null}
        role={viewer.profile.role}
        initial={{ title: "", subtitle: "", excerpt: "", tags: "", bodyMarkdown: "" }}
      />
    </>
  );
}
