import { redirect } from "next/navigation";

import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Where Discord sends people back to (E16.3).
 *
 * Trades the one-time code for a session and sets the cookies. The profile row
 * is not created here — migration 0016's trigger on `auth.users` has already
 * done it, before this handler could have run.
 *
 * Every failure lands back on `/login` with a reason. A bare error page here
 * would strand someone mid-flow with no way forward but the back button.
 */
export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));

  // Discord's own refusal: the visitor pressed Cancel, or the app is not
  // authorised. There is no code to exchange in this case.
  if (url.searchParams.get("error") !== null) {
    redirect(`${loginHref(next)}&error=denied`);
  }

  const code = url.searchParams.get("code");
  if (code === null) redirect(`${loginHref(next)}&error=denied`);

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    // Usually a stale link: the code is single-use and short-lived, so a
    // refresh or a revisited callback URL arrives here rather than signed in.
    console.error("discord callback could not exchange the code:", error.message);
    redirect(`${loginHref(next)}&error=exchange`);
  }

  redirect(next);
}
