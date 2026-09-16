import { PASSWORD_MIN_LENGTH } from "@ps/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell, Card, Field, Notice, SubmitButton } from "@/components/auth/form-parts";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { authMessage } from "@/lib/auth/auth-error";
import { safeNextPath } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

/**
 * Sign up with an address and a password (E16.9).
 *
 * The same providers are offered here as on the sign-in page, because to someone
 * who has never been here "sign in with Google" and "sign up with Google" are
 * the same action and only one of them can be the right button to look for.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params["next"] === "string" ? params["next"] : null);

  if ((await currentViewer()) !== null) redirect(next);

  const error = authMessage(params["error"]);

  return (
    <AuthShell
      title="Create an account"
      intro="You only need one to write something — reading the site never asks."
    >
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <form method="post" action="/auth/sign-up" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field
            label="Display name"
            name="displayName"
            autoComplete="name"
            maxLength={60}
            placeholder="Optional"
            hint="How you are credited on anything you write. You can change it later."
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. Length helps more than punctuation does.`}
          />
          <SubmitButton>Create account</SubmitButton>
        </form>

        <OAuthButtons next={next} />
      </Card>

      <p className="mt-6 text-center text-sm text-ink-600 dark:text-ink-400">
        Already have one?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
        >
          Sign in
        </Link>
        .
      </p>
    </AuthShell>
  );
}
