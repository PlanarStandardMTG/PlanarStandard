/**
 * The public origin of the site, as the browser that made this request sees it.
 *
 * OAuth needs an absolute callback URL, and behind Vercel's proxy `request.url`
 * is the internal address rather than the one the visitor typed. Getting this
 * wrong sends people to a host Supabase's redirect allow-list will reject, and
 * it only shows up in production — localhost has no proxy in front of it.
 */
export function originOf(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedHost === null || forwardedHost === "") return url.origin;

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${forwardedHost}`;
}
