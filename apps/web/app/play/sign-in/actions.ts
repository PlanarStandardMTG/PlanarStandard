"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authErrorCode, AUTH_MESSAGES } from "@/lib/auth/auth-error";
import { safeNextPath } from "@/lib/auth/next-path";
import { originOf } from "@/lib/auth/origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Signing in to the play app with an emailed code (E26.24, §28). A link opens the
 * browser, not the installed app, and on iOS the installed app keeps its own session —
 * so the app asks for the six digits the same email carries, and the session is set
 * where the code is typed. The link in the email still works in a browser.
 */

export interface CodeState {
  readonly step: "email" | "code";
  readonly email: string;
  readonly error: string | null;
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return originOf(new Request(`http://${host}`, { headers: h }));
}

/** Sends a code, or checks one, depending on the button pressed. */
export async function codeSignInAction(previous: CodeState, form: FormData): Promise<CodeState> {
  const next = safeNextPath(form.get("next")?.toString());
  const supabase = await createSessionClient();

  if (form.get("intent") !== "verify") {
    const email = (form.get("email")?.toString() ?? previous.email).trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error !== null) {
      const code = authErrorCode(error);
      // As on /login: an address or a rate limit is the visitor's to know, nothing else.
      if (code === "rate-limited" || code === "email-invalid" || code === "signups-disabled") {
        return { step: "email", email, error: AUTH_MESSAGES[code] };
      }
      console.error("sign-in code could not be sent:", error.message);
    }
    return { step: "code", email, error: null };
  }

  const token = (form.get("code")?.toString() ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) {
    return { ...previous, error: "The code is the six digits in the email." };
  }
  const { error } = await supabase.auth.verifyOtp({ email: previous.email, token, type: "email" });
  if (error !== null) {
    return { ...previous, error: "That code did not work. It may have expired: ask for another." };
  }
  redirect(next);
}
