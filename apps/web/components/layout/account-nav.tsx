import { meetsRole } from "@ps/core";
import Link from "next/link";

import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

/**
 * Sign in, or who you are (E20.1).
 *
 * Renders on the server, so the header never flickers from signed-out to
 * signed-in the way a client-side session check does. `currentViewer` is
 * memoised per request, so a page that also asks does not pay twice.
 *
 * Signing out is a form and not a link — see `app/auth/sign-out/route.ts`.
 */
export async function AccountNav() {
  const viewer = await currentViewer();

  if (viewer === null) {
    return (
      <Link
        href={loginHref("/profile")}
        className="shrink-0 text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3 text-sm">
      {viewer.profile.bannedAt === null && (
        <Link
          href="/dashboard"
          className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
        >
          Dashboard
        </Link>
      )}
      {viewer.profile.bannedAt === null && meetsRole(viewer.profile.role, "admin") && (
        <Link
          href="/admin"
          className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
        >
          Admin
        </Link>
      )}
      <Link
        href="/profile"
        className="font-medium text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-100"
      >
        {viewer.profile.displayName}
      </Link>
      <form method="post" action="/auth/sign-out">
        <button
          type="submit"
          className="cursor-pointer text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
