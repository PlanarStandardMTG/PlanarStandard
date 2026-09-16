import { checkPassword } from "@ps/core";
import { redirect } from "next/navigation";

import { authErrorCode } from "@/lib/auth/auth-error";
import { safeNextPath } from "@/lib/auth/next-path";
import { originOf } from "@/lib/auth/origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Create an account with an email address and a password (E16.9).
 *
 * Confirmation is required (`enable_confirmations`), so this never returns a
 * session — it sends an email and the visitor comes back through
 * `/auth/confirm`. `display_name` rides along in the user metadata, where
 * migration 0016's trigger reads it when it makes the profile row.
 *
 * **This form does say when an address is already registered, and that is a
 * deliberate trade.** Supabase obfuscates a repeat sign-up only while the first
 * one is still unconfirmed; once an account is confirmed it answers
 * `user_already_exists`, and we pass that through with somewhere to go. A
 * sign-up form that accepted the address and then did nothing would strand the
 * person who simply forgot they had signed up, which is a certainty, to hide
 * something an attacker can learn from any password form anyway.
 *
 * The flows worth protecting are the ones that can be scripted against a list of
 * addresses — the magic link and the password reset — and both of those stay
 * non-committal. See `magic-link/route.ts`.
 */
function signUpHref(next: string, query: string): string {
  return `/signup?next=${encodeURIComponent(next)}&${query}`;
}

export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const next = safeNextPath(form.get("next")?.toString());
  const email = (form.get("email")?.toString() ?? "").trim();
  const password = form.get("password")?.toString() ?? "";
  const displayName = (form.get("displayName")?.toString() ?? "").trim();

  const checked = checkPassword(password);
  if (!checked.ok) {
    redirect(
      signUpHref(next, `error=${checked.problem === "too-long" ? "unknown" : "weak-password"}`),
    );
  }

  const supabase = await createSessionClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${originOf(request)}/auth/confirm?next=${encodeURIComponent(next)}`,
      // Read by the profile trigger. Anything not set here falls back to the
      // email's local part, which is a worse name but never a missing one.
      data: displayName === "" ? {} : { full_name: displayName },
    },
  });

  if (error !== null) {
    redirect(signUpHref(next, `error=${authErrorCode(error) ?? "unknown"}`));
  }

  redirect(`/check-email?reason=confirm&next=${encodeURIComponent(next)}`);
}
