import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_OPTIONS } from "@/lib/auth/cookie-options";
import { CURRENT_PATH_HEADER } from "@/lib/auth/path-header";
import { strayCredentialTarget } from "@/lib/auth/stray-credential";

/**
 * Keeps the session alive (E16.2).
 *
 * `proxy.ts`, not `middleware.ts`: Next 16 deprecated that name and this is the
 * same feature under the one it kept.
 *
 * Supabase access tokens expire in an hour. Nothing else in the request cycle
 * can refresh them — a Server Component is not allowed to set cookies — so
 * without this a signed-in visitor is quietly signed out mid-visit. Calling
 * `getUser` here refreshes the token when it needs it and writes the new cookies
 * onto the response.
 *
 * It also catches a sign-in credential that landed on the wrong page, which
 * happens whenever a project's email templates are the Supabase defaults: those
 * link to Supabase's own verify endpoint, which drops the browser on the Site
 * URL with a `code` in the query string and nothing there to spend it. Routing
 * is not authorization — the request is forwarded to `/auth/confirm`, which
 * decides whether the credential is any good.
 *
 * **This is not the authorization boundary, and must not become one.** It
 * refreshes a session and nothing more. Who may see what is decided by
 * `lib/auth/guard.ts`, inside the render, next to the data. A proxy runs in
 * front of the app — it can be skipped by a request that never matches, it has
 * been bypassable by header in the past (CVE-2025-29927), and it knows nothing
 * about the row a page is about to read. A check out here is a convenience; the
 * check in the page is the rule.
 */
export async function proxy(request: NextRequest) {
  // A Server Component cannot see the URL it is rendering for, and a guard that
  // redirects to the login page has to know where to send the visitor back to.
  // Always `set`, never append: whatever the browser sent under this name is
  // overwritten here, so it cannot be used to aim the post-login redirect.
  const currentPath = request.nextUrl.pathname + request.nextUrl.search;

  // Before anything else: a credential in the query string is not a page view.
  const stray = strayCredentialTarget(request.nextUrl);
  if (stray !== null) return NextResponse.redirect(new URL(stray, request.nextUrl.origin));

  const build = () => {
    const headers = new Headers(request.headers);
    headers.set(CURRENT_PATH_HEADER, currentPath);
    return NextResponse.next({ request: { headers } });
  };

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  // A deployment without Supabase configured still serves every public page.
  if (url === undefined || anonKey === undefined) return build();

  let response = build();

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) request.cookies.set(name, value);
        // Rebuilt from the mutated request, so the refreshed cookies reach both
        // this render and the browser.
        response = build();
        for (const { name, value, options } of written) {
          response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. Image and font requests outnumber page
     * views several to one, and none of them carry a session worth refreshing.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
