import type { UserRole } from "@ps/contracts";
import { meetsRole } from "@ps/core";
import { redirect } from "next/navigation";

import { currentPath } from "./current-path";
import { loginHref } from "./next-path";
import { currentViewer, type Viewer } from "./viewer";

/**
 * The two ways a page says who it is for (E16.5).
 *
 * Called at the top of a protected page or layout, before it reads anything:
 *
 *     const viewer = await requireRole("organizer");
 *
 * The call site is the declaration. There is no list of protected routes
 * anywhere — a route is protected because it asks to be, which means a new page
 * under `/dashboard` cannot be left unguarded by forgetting to add it to a
 * registry it does not know exists. The cost is that the guard must be the first
 * thing the page does; the benefit is that the rule is visible in the file it
 * applies to.
 *
 * These run in the render, not in `proxy.ts`. A check in front of the app is a
 * convenience for the visitor. This is the one that decides.
 *
 * Neither of these is a substitute for RLS. A guard stops a page from rendering;
 * a policy stops a row from moving. E14 is what makes the second true, and a
 * guard that ever disagrees with a policy is a bug in the guard.
 */

/**
 * Anyone signed in.
 *
 * Signed out, the visitor is sent to the login page with their destination
 * remembered, and comes back to it once Discord is done.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (viewer !== null) return viewer;

  redirect(loginHref(await currentPath()));
}

/**
 * Someone at or above a rung of the ladder (`core/auth/meets-role`).
 *
 * Signed out is a redirect to the login page, because signing in might be all
 * that is needed. Signed in and short of the bar is **not** a redirect home:
 * a visitor bounced silently to the home page cannot tell a permission from a
 * broken link, and will try again. `/unauthorized` says which account they are
 * using and what it would need, which is the difference between a dead end and
 * something they can act on.
 */
export async function requireRole(required: UserRole): Promise<Viewer> {
  const viewer = await requireViewer();
  if (meetsRole(viewer.profile.role, required)) return viewer;

  const from = await currentPath();
  redirect(`/unauthorized?from=${encodeURIComponent(from)}&need=${required}`);
}
