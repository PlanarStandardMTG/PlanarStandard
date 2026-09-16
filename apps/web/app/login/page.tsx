import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { safeNextPath } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

/** Reads a session cookie, so it can never be a build-time page. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Planar Standard with Discord.",
  // A login page has nothing to index and every reason not to be a search result.
  robots: { index: false, follow: false },
};

/**
 * The one way in (E16.3, E20.1).
 *
 * Discord and nothing else. The format's community lives there, it is where
 * organizers are already known to each other, and every account the site cares
 * about has one — so a second provider would add a second identity to reconcile
 * for no one's benefit. §17 of the plan accepts the cost: this is one of only
 * two tasks in the repository that needs real credentials.
 */
const ERRORS: Readonly<Record<string, string>> = {
  denied: "That sign-in was cancelled before it finished. Nothing was saved.",
  exchange: "That sign-in link had already been used. Signing in again will work.",
  provider: "Discord sign-in is not available right now. Please try again shortly.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = typeof params["next"] === "string" ? params["next"] : null;
  const next = safeNextPath(rawNext);

  // Already signed in: send them where they were going rather than offering a
  // button that would only bounce them through Discord to the same place.
  const viewer = await currentViewer();
  if (viewer !== null) redirect(next);

  const rawError = typeof params["error"] === "string" ? params["error"] : null;
  const error = rawError === null ? null : (ERRORS[rawError] ?? ERRORS["provider"]);

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-ink-600 dark:text-ink-400">
          Planar Standard uses Discord accounts, so there is no new password to remember.
        </p>

        {error !== null && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {error}
          </p>
        )}

        <Card className="mt-6 p-6">
          <form method="post" action="/auth/sign-in">
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-3 font-medium text-white transition-colors hover:bg-[#4752c4]"
            >
              Continue with Discord
            </button>
          </form>

          <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
            We read your Discord username and avatar, and nothing else. Everything on this site is
            readable without an account — signing in is for writing.
          </p>
        </Card>
      </div>
    </Container>
  );
}
