import { PASSWORD_MIN_LENGTH } from "@ps/core";
import type { Metadata } from "next";

import { AuthShell, Card, Field, Notice, SubmitButton } from "@/components/auth/form-parts";
import { AUTH_MESSAGES, isAuthErrorCode } from "@/lib/auth/auth-error";
import { requireViewer } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * Choose a new password (E16.9).
 *
 * Reached from a recovery link — `/auth/confirm` verifies it and signs the
 * person in on the way here — or from the profile page while already signed in.
 * Either way `requireViewer` is what stands at the door, so a recovery link that
 * has expired lands on the login page rather than on an empty form.
 */
const LOCAL_ERRORS: Readonly<Record<string, string>> = {
  mismatch: "Those two passwords are not the same.",
  blank: "A password cannot be blank.",
  "too-short": `A password needs at least ${PASSWORD_MIN_LENGTH} characters.`,
  "too-long": "That password is longer than the 72 bytes bcrypt will hash. Shorten it.",
};

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireViewer();

  const params = await searchParams;
  const raw = typeof params["error"] === "string" ? params["error"] : null;
  const error =
    raw === null
      ? null
      : (LOCAL_ERRORS[raw] ?? (isAuthErrorCode(raw) ? AUTH_MESSAGES[raw] : AUTH_MESSAGES.unknown));

  return (
    <AuthShell
      title="Set a new password"
      intro="This replaces whatever you had before. Any link you were emailed stops working once you do."
    >
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <form method="post" action="/auth/update-password" className="space-y-4">
          <Field
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          />
          <Field
            label="Again, to be sure"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
          <SubmitButton>Save new password</SubmitButton>
        </form>
      </Card>
    </AuthShell>
  );
}
