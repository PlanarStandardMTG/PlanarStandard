import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the session alive (E16.2).
 *
 * Supabase access tokens expire in an hour. Nothing else in the request cycle
 * can refresh them — a Server Component is not allowed to set cookies — so
 * without this a signed-in visitor is quietly signed out mid-visit. Calling
 * `getUser` here refreshes the token when it needs it and writes the new cookies
 * onto the response.
 *
 * **This is not the authorization boundary, and must not become one.** It
 * refreshes a session and nothing more. Who may see what is decided by
 * `lib/auth/guard.ts`, inside the render, next to the data — middleware can be
 * skipped by a request that never reaches the matcher, has been bypassable by
 * header in the past (CVE-2025-29927), and knows nothing about the row a page is
 * about to read. A guard in front of the page is a convenience; a guard in the
 * page is the rule.
 */
export async function middleware(request: NextRequest) {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  // A deployment without Supabase configured still serves every public page.
  if (url === undefined || anonKey === undefined) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) request.cookies.set(name, value);
        // A fresh response, built from the mutated request, so the refreshed
        // cookies reach both this render and the browser.
        response = NextResponse.next({ request });
        for (const { name, value, options } of written) response.cookies.set(name, value, options);
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
