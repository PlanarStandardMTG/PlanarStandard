import { DEFAULT_NEXT, safeNextPath } from "@/lib/auth/next-path";

/**
 * Where to send a request that arrived carrying a sign-in credential meant for
 * `/auth/confirm`.
 *
 * Supabase's **default** email templates do not link here. They link to its own
 * `/auth/v1/verify`, which redirects to the project's Site URL carrying a `code`
 * — so the browser lands on the site root, or on whatever page the Site URL
 * names, with a credential in the query string and nothing there to spend it.
 * The visitor sees `?code=…` in the address bar and is not signed in.
 *
 * Our templates link straight to `/auth/confirm` and avoid this. This exists
 * because that is a setting in somebody's dashboard rather than a fact about the
 * deployment, and a sign-in that depends on a setting being right is a sign-in
 * that breaks quietly.
 *
 * Returns null when there is nothing to do, which is almost every request.
 */
export function strayCredentialTarget(url: URL): string | null {
  // Already at a handler that knows what to do with it.
  if (url.pathname.startsWith("/auth/")) return null;

  const params = url.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  const carried =
    (tokenHash !== null && tokenHash !== "" && type !== null && type !== "") ||
    (code !== null && code !== "");
  if (!carried) return null;

  // Back to where they were heading once the session exists — `next` if the link
  // carried one, otherwise this page without its credential. The whole point is
  // that the code does not survive into the address bar.
  const next = params.get("next");
  const cleaned = new URL(url);
  for (const name of ["token_hash", "type", "code", "next"]) cleaned.searchParams.delete(name);
  const fallback = url.pathname === "/" ? DEFAULT_NEXT : cleaned.pathname + cleaned.search;

  const target = new URL("/auth/confirm", url.origin);
  target.searchParams.set("next", safeNextPath(next, fallback));
  if (tokenHash !== null && tokenHash !== "") target.searchParams.set("token_hash", tokenHash);
  if (type !== null && type !== "") target.searchParams.set("type", type);
  if (code !== null && code !== "") target.searchParams.set("code", code);

  return target.pathname + target.search;
}
