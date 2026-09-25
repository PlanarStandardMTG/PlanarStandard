import { headers } from "next/headers";

/**
 * The public origin, from inside a render or a server action — where there is no
 * `Request` to hand to `auth/origin.ts`. Same order and same reasons: the
 * configured canonical site first, then the proxy's forwarded host.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env["NEXT_PUBLIC_SITE_URL"];
  if (configured !== undefined && configured !== "") return configured.replace(/\/+$/, "");

  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol =
    list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
