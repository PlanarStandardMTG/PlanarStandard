import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, Card, Field, Notice, SubmitButton } from "@/components/auth/form-parts";
import { authMessage } from "@/lib/auth/auth-error";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

/**
 * Ask for a password reset link (E16.9).
 *
 * Says nothing about whether the address has an account — see
 * `app/auth/recover/route.ts`. The answer goes to the address.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = authMessage(params["error"]);

  return (
    <AuthShell
      title="Reset your password"
      intro="Give us the address on the account and we will email you a link to choose a new password."
    >
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <form method="post" action="/auth/recover" className="space-y-4">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <SubmitButton>Email me a reset link</SubmitButton>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-600 dark:text-ink-400">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
        >
          Sign in
        </Link>
        .
      </p>
    </AuthShell>
  );
}
