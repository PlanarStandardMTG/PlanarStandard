import type { PostKind } from "@ps/contracts";
import { canWriteKind } from "@ps/core";
import Link from "next/link";

import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

/** Where the editor starts for each kind. */
export function newPostHref(kind: PostKind): string {
  return kind === "official"
    ? "/dashboard/community/new?kind=official"
    : "/dashboard/community/new";
}

const BUTTON =
  "inline-block shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white " +
  "hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white";

/**
 * The way into the editor from a feed. Anyone may write a community post, so a
 * signed-out visitor is offered sign-in and brought back to the editor; news
 * is admin-only, so everybody else sees nothing rather than a door that is shut.
 * Hiding it is a courtesy — the editor and RLS both check again.
 */
export async function WritePostButton({ kind }: { kind: PostKind }) {
  const viewer = await currentViewer();
  const href = newPostHref(kind);

  if (viewer === null) {
    return kind === "community" ? (
      <Link href={loginHref(href)} className={BUTTON}>
        Sign in to write a community post
      </Link>
    ) : null;
  }

  if (viewer.profile.bannedAt !== null || !canWriteKind(viewer.profile.role, kind)) return null;

  return (
    <Link href={href} className={BUTTON}>
      {kind === "official" ? "Write a news post" : "Write a community post"}
    </Link>
  );
}
