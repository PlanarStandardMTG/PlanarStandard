import { describe, expect, it } from "vitest";

import { AUTH_MESSAGES, authErrorCode, authMessage, isAuthErrorCode } from "./auth-error";

describe("authErrorCode", () => {
  it("has nothing to say about success", () => {
    expect(authErrorCode(null)).toBeNull();
  });

  it("maps the codes Supabase actually returns", () => {
    expect(authErrorCode({ code: "invalid_credentials" })).toBe("invalid-credentials");
    expect(authErrorCode({ code: "email_not_confirmed" })).toBe("email-not-confirmed");
    expect(authErrorCode({ code: "weak_password" })).toBe("weak-password");
    expect(authErrorCode({ code: "over_email_send_rate_limit" })).toBe("rate-limited");
    expect(authErrorCode({ code: "otp_expired" })).toBe("link-expired");
    expect(authErrorCode({ code: "user_already_exists" })).toBe("email-taken");
  });

  it("falls back to the status when there is no code", () => {
    expect(authErrorCode({ status: 429 })).toBe("rate-limited");
  });

  it("falls back to the message when there is neither", () => {
    // Older releases and a few endpoints answer with a sentence alone.
    expect(authErrorCode({ message: "Invalid login credentials" })).toBe("invalid-credentials");
    expect(authErrorCode({ message: "Email not confirmed" })).toBe("email-not-confirmed");
    expect(authErrorCode({ message: "Token has expired or is invalid" })).toBe("link-expired");
    expect(authErrorCode({ message: "User already registered" })).toBe("email-taken");
  });

  it("says so plainly rather than guessing", () => {
    expect(authErrorCode({ code: "something_new_in_gotrue" })).toBe("unknown");
    expect(authErrorCode({})).toBe("unknown");
  });
});

describe("authMessage", () => {
  it("has nothing to say when nothing went wrong", () => {
    expect(authMessage(null)).toBeNull();
    expect(authMessage(undefined)).toBeNull();
    expect(authMessage("")).toBeNull();
  });

  it("turns a known code into its sentence", () => {
    expect(authMessage("invalid-credentials")).toBe(AUTH_MESSAGES["invalid-credentials"]);
  });

  /**
   * The reason codes travel in a query string rather than sentences. A crafted
   * link can only ever produce one of ours — never arbitrary text on our page
   * over our name, which is how a login page gets used for phishing.
   */
  it("refuses to render anything it was not given by us", () => {
    expect(authMessage("Your account is suspended, call 555-0100")).toBe(AUTH_MESSAGES.unknown);
    expect(authMessage("<script>alert(1)</script>")).toBe(AUTH_MESSAGES.unknown);
    expect(authMessage(42)).toBe(AUTH_MESSAGES.unknown);
  });

  it("does not mistake an inherited property for a code", () => {
    expect(isAuthErrorCode("constructor")).toBe(false);
    expect(isAuthErrorCode("toString")).toBe(false);
    expect(authMessage("constructor")).toBe(AUTH_MESSAGES.unknown);
  });

  it("has a sentence for every code it can produce", () => {
    for (const code of Object.keys(AUTH_MESSAGES)) {
      expect(authMessage(code)).not.toBe("");
      expect(isAuthErrorCode(code)).toBe(true);
    }
  });
});
