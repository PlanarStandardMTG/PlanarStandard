import type { PostStatus } from "@ps/contracts";
import { canEditOwnPost, submissionStatus } from "@ps/core";
import { listPostsByAuthor } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { WritePostButton } from "@/components/content/write-post-button";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { postHref } from "@/lib/post-url";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your community posts",
  robots: { index: false, follow: false },
};

const STATUS: Readonly<Record<PostStatus, { label: string; variant: BadgeVariant }>> = {
  draft: { label: "Draft", variant: "outline" },
  review: { label: "Awaiting review", variant: "neutral" },
  published: { label: "Published", variant: "accent" },
  archived: { label: "Archived", variant: "outline" },
};

/** What a member has written, and a way to write more (E20.22, E20.2). */
export default async function DashboardCommunityPage() {
  const viewer = await requireRole("reader");
  const direct = submissionStatus(viewer.profile.role) === "published";

  const supabase = await createSessionClient();
  const posts = await listPostsByAuthor(supabase, viewer.profile.id);

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Your community posts</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          {direct
            ? `As a ${viewer.profile.role}, what you submit is published straight away.`
            : "What you submit waits for a writer or an admin to approve it before it is published."}
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <WritePostButton kind="community" />
        <WritePostButton kind="official" />
      </div>

      <h2 className="mt-10 mb-4 font-serif text-xl font-semibold">Written</h2>
      {posts.length === 0 ? (
        <EmptyState title="Nothing yet">Drafts and submissions are listed here.</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                {canEditOwnPost(post.status, viewer.profile.role) ? (
                  <Link
                    href={`/dashboard/community/${post.id}/edit`}
                    className="font-medium text-ink-900 hover:underline dark:text-ink-100"
                  >
                    {post.title}
                  </Link>
                ) : post.status === "published" ? (
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
              <Badge variant={STATUS[post.status].variant} className="shrink-0">
                {STATUS[post.status].label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
