import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AuthShell,
  Card,
  Divider,
  Field,
  Notice,
  SubmitButton,
} from "@/components/auth/form-parts";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { authMessage } from "@/lib/auth/auth-error";
import { safeNextPath } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Planar Standard.",
  // A login page has nothing to index and every reason not to be a search result.
  robots: { index: false, follow: false },
};

/**
 * Three ways in, in the order most people want them (E16.9, E20.1).
 *
 * Password first because it is what someone with an account reaches for; the
 * emailed link next because it is the shortest path for everyone else and needs
 * no password at all; the providers last because they are recognisable enough to
 * find at a glance.
 *
 * No provider is privileged. Discord is one option among several rather than the
 * door — the community lives there, but requiring it would turn "read this site"
 * into "join our chat server first", and an account here is for writing, not for
 * reading.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params["next"] === "string" ? params["next"] : null);

  // Already signed in: send them where they were going rather than offering
  // three buttons that all land in the same place.
  if ((await currentViewer()) !== null) redirect(next);

  const error = authMessage(params["error"]);

  return (
    <AuthShell
      title="Sign in"
      intro="Everything here is readable without an account. Signing in is for writing — posting to the community, running an event, submitting a deck."
    >
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <form method="post" action="/auth/password" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-eclipse-700 hover:underline dark:text-eclipse-400"
              >
                Forgotten?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
            />
          </div>
          <SubmitButton>Sign in</SubmitButton>
        </form>

        <Divider>or</Divider>

        <form method="post" action="/auth/magic-link" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field
            label="Email me a link instead"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            hint="No password needed. If you have never signed in before, this makes you an account."
          />
          <button
            type="submit"
            className="w-full rounded-lg border border-ink-300 px-4 py-2.5 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
          >
            Send me a sign-in link
          </button>
        </form>

        <OAuthButtons next={next} />
      </Card>

      <p className="mt-6 text-center text-sm text-ink-600 dark:text-ink-400">
        No account yet?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
        >
          Create one
        </Link>
        .
      </p>
    </AuthShell>
  );
}
