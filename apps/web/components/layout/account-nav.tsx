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
const LINK = "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100";

/** `inline` for the header line at `xl`; `stacked` for the menu below it, one tap target per row. */
export async function AccountNav({ layout }: { layout: "inline" | "stacked" }) {
  const viewer = await currentViewer();
  const stacked = layout === "stacked";
  const row = stacked ? "block py-3" : "";

  if (viewer === null) {
    return (
      <Link
        href={loginHref("/profile")}
        className={`${row} shrink-0 font-medium text-eclipse-700 hover:underline dark:text-eclipse-400 ${stacked ? "" : "text-sm"}`}
      >
        Sign in
      </Link>
    );
  }

  const active = viewer.profile.bannedAt === null;
  return (
    <div className={stacked ? "flex flex-col" : "flex shrink-0 items-center gap-3 text-sm"}>
      {active && (
        <Link href="/dashboard" className={`${row} ${LINK}`}>
          Dashboard
        </Link>
      )}
      {active && meetsRole(viewer.profile.role, "admin") && (
        <Link href="/admin" className={`${row} ${LINK}`}>
          Admin
        </Link>
      )}
      <Link
        href="/profile"
        className={`${row} font-medium text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-100`}
      >
        {stacked ? `Profile · ${viewer.profile.displayName}` : viewer.profile.displayName}
      </Link>
      <form method="post" action="/auth/sign-out">
        <button
          type="submit"
          className={`${row} cursor-pointer text-left text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200`}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
