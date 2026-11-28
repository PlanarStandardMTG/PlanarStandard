import { redirect } from "next/navigation";

import { authErrorCode } from "@/lib/auth/auth-error";
import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Sign in with an email address and a password (E16.9).
 *
 * Unlike the link-based routes, this one does say when it failed and roughly
 * why. Someone typing a password already knows whether they have an account —
 * refusing to distinguish "wrong password" from "no such account" would only
 * strand the person who mistyped, and the address is not a secret to whoever is
 * holding the keyboard.
 */
export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const next = safeNextPath(form.get("next")?.toString());
  const email = (form.get("email")?.toString() ?? "").trim();
  const password = form.get("password")?.toString() ?? "";

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    redirect(`${loginHref(next)}&error=${authErrorCode(error) ?? "unknown"}`);
  }

  redirect(next);
}
