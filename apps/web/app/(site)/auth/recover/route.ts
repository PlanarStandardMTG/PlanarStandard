import { redirect } from "next/navigation";

import { authErrorCode } from "@/lib/auth/auth-error";
import { originOf } from "@/lib/auth/origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Email somebody a link to choose a new password (E16.9).
 *
 * The link lands on `/auth/confirm`, which verifies it and *establishes a
 * session* before forwarding to `/account/password`. That is what makes the
 * next step work: setting a password is an authenticated action, and the
 * recovery link is what authenticates it.
 *
 * Reports nothing but a rate limit, for the same reason as the magic link: a
 * form that answered "no such account" would be a way to ask who has one.
 */
export async function POST(request: Request): Promise<never> {
  const form = await request.formData();
  const email = (form.get("email")?.toString() ?? "").trim();

  const supabase = await createSessionClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${originOf(request)}/auth/confirm?next=%2Faccount%2Fpassword`,
  });

  if (error !== null) {
    const code = authErrorCode(error);
    if (code === "rate-limited" || code === "email-invalid") {
      redirect(`/forgot-password?error=${code}`);
    }
    console.error("recovery email could not be sent:", error.message);
  }

  redirect("/check-email?reason=recovery");
}
