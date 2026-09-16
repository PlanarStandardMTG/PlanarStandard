import { isUserRole } from "@ps/core";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { safeNextPath } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Not your account's to see",
  robots: { index: false, follow: false },
};

/**
 * Signed in, but not far enough up the ladder (E16.5).
 *
 * A page rather than a redirect home. Someone bounced to the home page cannot
 * tell a permission from a broken link and will try the same link again; this
 * says which account they are using, what that account would need, and who
 * changes it. Both parameters are display-only and both are validated anyway —
 * the page grants nothing, so the worst a forged one does is show a sentence
 * that is not true.
 */
const ASKS: Readonly<Record<string, string>> = {
  reader: "an account",
  writer: "a writer account",
  organizer: "an organizer account",
  admin: "an admin account",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await currentViewer();

  const rawFrom = typeof params["from"] === "string" ? params["from"] : null;
  const from = rawFrom === null ? null : safeNextPath(rawFrom, "");

  const rawNeed = typeof params["need"] === "string" ? params["need"] : null;
  const need = isUserRole(rawNeed) ? rawNeed : null;

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          That one&rsquo;s not yours to see
        </h1>

        <p className="mt-3 text-ink-600 dark:text-ink-400">
          {from !== null && from !== "" ? (
            <>
              <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm dark:bg-ink-800">
                {from}
              </code>{" "}
              needs {need === null ? "a different account" : ASKS[need]}
              {viewer === null ? "." : `, and yours is a ${viewer.profile.role} account.`}
            </>
          ) : (
            <>That page needs an account with more access than yours has.</>
          )}
        </p>

        <Card className="mt-6 p-6 text-sm">
          <p className="text-ink-600 dark:text-ink-400">
            Roles are granted by the format&rsquo;s admins, not requested from this page. If you run
            events or write for the site and need access, ask in{" "}
            <a
              href="https://discord.gg/eeYH9XMCjT"
              className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
            >
              the Discord
            </a>
            .
          </p>

          <div className="mt-5 flex gap-4">
            <Link
              href="/"
              className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
            >
              Back to the home page
            </Link>
            {viewer !== null && (
              <Link
                href="/profile"
                className="text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
              >
                Your profile
              </Link>
            )}
          </div>
        </Card>
      </div>
    </Container>
  );
}
