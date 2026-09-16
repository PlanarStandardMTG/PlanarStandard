import { redirect } from "next/navigation";

import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { originOf } from "@/lib/auth/origin";
import { isOAuthProvider } from "@/lib/auth/providers";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Start an OAuth sign-in (E16.9).
 *
 * The provider arrives in the form body and is checked against
 * `OAUTH_PROVIDERS` before it is used, so this cannot be pointed at a provider
 * the site does not offer.
 *
 * POST from a form, not a link. Signing in changes state, and a GET would let a
 * prefetch, a crawler, or an `<img>` tag start a round trip nobody asked for.
 */
export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const next = safeNextPath(form.get("next")?.toString());
  const provider = form.get("provider")?.toString();

  if (!isOAuthProvider(provider)) {
    redirect(`${loginHref(next)}&error=provider-unavailable`);
  }

  const supabase = await createSessionClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    // Checked against the catalogue above; `Provider` is a closed union in the
    // SDK and this is the one place the two meet.
    provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"],
    options: {
      redirectTo: `${originOf(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      // We do the redirecting; this call builds the URL and writes the PKCE
      // verifier cookie the callback will need.
      skipBrowserRedirect: true,
    },
  });

  if (error !== null || data.url === null) {
    console.error(`${provider} sign-in could not start:`, error?.message ?? "no url returned");
    redirect(`${loginHref(next)}&error=provider-unavailable`);
  }

  redirect(data.url);
}
