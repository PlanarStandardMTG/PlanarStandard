/**
 * How the session cookie is written (E16.9).
 *
 * `@supabase/ssr` leaves the auth cookie readable by JavaScript, because its
 * *browser* client reads the session out of `document.cookie`. This repository
 * has no browser client — every sign-in is a form POST to a route handler, and
 * every read of the session happens on the server — so that access buys us
 * nothing and costs us the difference between an XSS bug and a stolen session.
 *
 * Shared by `lib/supabase/session.ts` and `proxy.ts`. Both write this cookie, and
 * two sets of flags that drifted apart would mean the flags depended on which
 * one happened to refresh the token last.
 *
 * **If a browser Supabase client is ever added, `httpOnly` has to go** — and
 * that is a trade to make deliberately, which is why it is one word in one file.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  // Off in development, where the dev server is plain http. Browsers accept a
  // Secure cookie over http on localhost, but not over http on a LAN address —
  // and `next dev` prints one of those for testing on a phone.
  secure: process.env.NODE_ENV === "production",
  /**
   * `lax` and not `strict`: an OAuth sign-in returns as a cross-site navigation
   * from the provider, and `strict` would withhold the cookie on exactly that
   * request. `lax` still withholds it from cross-site POSTs, which is the case
   * that matters.
   */
  sameSite: "lax",
  path: "/",
} as const;
