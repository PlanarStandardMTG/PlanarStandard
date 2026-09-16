import { redirect } from "next/navigation";

import { authErrorCode } from "@/lib/auth/auth-error";
import { loginHref, safeNextPath } from "@/lib/auth/next-path";
import { originOf } from "@/lib/auth/origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Email somebody a link that signs them in (E16.9).
 *
 * Doubles as a sign-up: `shouldCreateUser` is left at its default, so a first-
 * time visitor gets an account and a confirmed address in one step and never
 * chooses a password at all. That is the shortest honest path onto the site, and
 * the reason this is offered next to the password form rather than buried.
 *
 * Only a rate limit is reported back. Whether the address has an account is not
 * something this form will tell you — the answer goes to the address itself.
 */
export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const next = safeNextPath(form.get("next")?.toString());
  const email = (form.get("email")?.toString() ?? "").trim();

  const supabase = await createSessionClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${originOf(request)}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error !== null) {
    const code = authErrorCode(error);
    // A malformed address and a rate limit are the visitor's business. Anything
    // else is ours: reporting it would leak whether the account exists.
    if (code === "rate-limited" || code === "email-invalid" || code === "signups-disabled") {
      redirect(`${loginHref(next)}&error=${code}`);
    }
    console.error("magic link could not be sent:", error.message);
  }

  redirect(`/check-email?reason=link&next=${encodeURIComponent(next)}`);
}
