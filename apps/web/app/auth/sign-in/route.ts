import { redirect } from "next/navigation";

import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { originOf } from "@/lib/auth/origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Start a Discord sign-in (E16.3).
 *
 * A POST from a form rather than a link, and a route handler rather than a
 * client component. Signing in changes state, so it should not be reachable by
 * anything that follows links — a prefetch or a crawler hitting a GET would
 * start an OAuth round trip nobody asked for. The whole flow works with
 * JavaScript switched off, which is also why there is no browser Supabase
 * client in the repository yet.
 */
export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const next = safeNextPath(form.get("next")?.toString());

  const supabase = await createSessionClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      // Where Discord sends the visitor back to. `next` rides along so the
      // callback knows where they were going before they were interrupted.
      redirectTo: `${originOf(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      // We do the redirecting; this call only builds the URL and writes the PKCE
      // verifier cookie that the callback will need.
      skipBrowserRedirect: true,
    },
  });

  if (error !== null || data.url === null) {
    console.error("discord sign-in could not start:", error?.message ?? "no url returned");
    redirect(`${loginHref(next)}&error=provider`);
  }

  redirect(data.url);
}
