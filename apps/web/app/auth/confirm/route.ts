import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Where every emailed link lands (E16.9).
 *
 * Sign-up confirmations, magic links, password recovery, and email changes all
 * arrive here. Each carries a `token_hash` and a `type`; verifying it
 * establishes the session and sets the cookies, exactly as the OAuth callback
 * does with a code.
 *
 * **Why not the default `{{ .ConfirmationURL }}`:** that sends the browser
 * through Supabase's own verify endpoint, which hands the result back in a URL
 * *fragment*. A fragment is never sent to the server, so a server-rendered site
 * cannot read it. The token-hash form is exchanged here instead — which also
 * means a link opened on a different device than it was requested from still
 * works, because there is no PKCE verifier cookie to be missing.
 *
 * A `code` is still accepted, so a link built the old way is not a dead end.
 */
const OTP_TYPES = new Set<string>([
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email",
  "email_change",
]);

export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));

  // The provider or Supabase refused before any token was issued.
  if (url.searchParams.get("error") !== null) {
    redirect(`${loginHref(next)}&error=provider-denied`);
  }

  const supabase = await createSessionClient();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (tokenHash !== null && type !== null && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    if (error !== null) {
      // Almost always a link that was already used or has aged out. Both are
      // ordinary, and both are fixed by asking for another one.
      redirect(`${loginHref(next)}&error=link-expired`);
    }

    redirect(next);
  }

  const code = url.searchParams.get("code");
  if (code !== null) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error !== null) redirect(`${loginHref(next)}&error=link-expired`);
    redirect(next);
  }

  redirect(`${loginHref(next)}&error=link-expired`);
}
