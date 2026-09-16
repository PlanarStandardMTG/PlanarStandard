/**
 * The public origin to build emailed and OAuth links from.
 *
 * Three sources, in order, and the order is the fix for two different bugs.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set. Vercel gives every deployment its
 * own hostname, so without this a magic link requested from a preview deploy
 * points back at that preview — a URL Supabase's allow-list rejects and nobody
 * meant to share. Set it to the canonical site and every link is canonical
 * wherever it was built.
 *
 * `x-forwarded-host` is next, because behind Vercel's proxy `request.url` is the
 * internal address rather than the one the visitor typed.
 *
 * `request.url` last, which is what local development uses and what a plain
 * Node server would see.
 */
export function originOf(request: Request): string {
  const configured = process.env["NEXT_PUBLIC_SITE_URL"];
  if (configured !== undefined && configured !== "") return configured.replace(/\/+$/, "");

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedHost === null || forwardedHost === "") return url.origin;

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${forwardedHost}`;
}
