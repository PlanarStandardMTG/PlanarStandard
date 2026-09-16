/**
 * Turning an auth failure into something worth reading (E16.9).
 *
 * Two jobs, and the split matters. `authErrorCode` maps a Supabase error onto a
 * short code that is safe to put in a URL; `AUTH_MESSAGES` turns a code into a
 * sentence. Codes travel through the query string, so a crafted link can only
 * ever produce one of the sentences below — never arbitrary text on our page
 * over our name.
 */

/** What the query string is allowed to say. */
export type AuthErrorCode =
  | "invalid-credentials"
  | "email-not-confirmed"
  | "weak-password"
  | "same-password"
  | "email-invalid"
  | "email-taken"
  | "rate-limited"
  | "link-expired"
  | "provider-denied"
  | "provider-unavailable"
  | "signups-disabled"
  | "unknown";

interface SupabaseishError {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
  readonly message?: string | undefined;
}

/**
 * Supabase's `code` where there is one, its message where there is not.
 *
 * The string matching is a fallback and not the plan: older releases and some
 * endpoints answer with a message alone. Anything unrecognised becomes
 * `unknown`, which says so plainly rather than guessing.
 */
export function authErrorCode(error: SupabaseishError | null): AuthErrorCode | null {
  if (error === null) return null;

  switch (error.code) {
    case "invalid_credentials":
      return "invalid-credentials";
    case "email_not_confirmed":
      return "email-not-confirmed";
    case "weak_password":
      return "weak-password";
    case "same_password":
      return "same-password";
    case "user_already_exists":
    case "email_exists":
      return "email-taken";
    case "email_address_invalid":
    case "validation_failed":
      return "email-invalid";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rate-limited";
    case "otp_expired":
      return "link-expired";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signups-disabled";
    default:
      break;
  }

  if (error.status === 429) return "rate-limited";

  const message = (error.message ?? "").toLowerCase();
  if (message.includes("already registered")) return "email-taken";
  if (message.includes("invalid login credentials")) return "invalid-credentials";
  if (message.includes("email not confirmed")) return "email-not-confirmed";
  if (message.includes("expired") || message.includes("invalid token")) return "link-expired";

  return "unknown";
}

export const AUTH_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  "invalid-credentials": "That email and password do not match an account.",
  "email-not-confirmed":
    "That account still needs confirming. Check your email for the link we sent when you signed up.",
  "weak-password": "That password is too short.",
  "same-password": "That is already your password. Choose a different one.",
  "email-invalid": "That does not look like an email address.",
  "email-taken":
    "That address already has an account. Sign in instead, or reset the password if you have forgotten it.",
  "rate-limited": "Too many attempts. Wait a minute and try again.",
  "link-expired": "That link has expired or has already been used. Ask for a new one.",
  "provider-denied": "That sign-in was cancelled before it finished. Nothing was saved.",
  "provider-unavailable": "That sign-in option is not available right now. Try another.",
  "signups-disabled": "New accounts are closed at the moment.",
  unknown: "That did not work. Please try again.",
};

/** Narrows whatever arrived in `?error=`. */
export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && Object.hasOwn(AUTH_MESSAGES, value);
}

/** The sentence for a query-string value, or null when there is nothing to say. */
export function authMessage(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return isAuthErrorCode(raw) ? AUTH_MESSAGES[raw] : AUTH_MESSAGES.unknown;
}
