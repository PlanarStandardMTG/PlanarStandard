import type { Metadata } from "next";

import { AuthShell, Card, Notice } from "@/components/auth/form-parts";
import { Link } from "@/components/ui/link";
import { requireViewer } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your data",
  robots: { index: false, follow: false },
};

/**
 * See what we hold, take a copy, or leave (E16.10, E16.11).
 *
 * The two rights that need a button — access and erasure — in one place, next to
 * a plain statement of what is held. Erasure is last, needs a typed word, and
 * says what survives before it asks.
 */
const ERRORS: Readonly<Record<string, string>> = {
  confirm: "Type DELETE to confirm.",
};

export default async function AccountDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireViewer();
  const params = await searchParams;
  const raw = typeof params["error"] === "string" ? params["error"] : null;
  const error = raw === null ? null : (ERRORS[raw] ?? "That did not work.");

  return (
    <AuthShell title="Your data" intro="What we hold about you, a copy of it, and deleting it.">
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-semibold">What we hold</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-ink-400">
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Your email address</strong>, used
            only to sign you in. Never shown.
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">
              Your display name, handle, and bio
            </strong>{" "}
            — public.
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Your posts and decks</strong>
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Sign-in records</strong>, kept by our
            authentication provider.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
          Your password is stored only as a hash. No ads, no analytics, nothing sold or shared.
          Details in the{" "}
          <Link
            href="/privacy"
            className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            privacy notice
          </Link>
          .
        </p>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-semibold">Take a copy</h2>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          Your profile, posts (drafts included) and decks, as JSON.
        </p>
        <a
          href="/account/data/export"
          className="mt-4 inline-block rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
        >
          Download my data
        </a>
      </Card>

      <Card className="mt-6 border-red-300 p-6 dark:border-red-900">
        <h2 className="font-display text-lg font-semibold">Delete your account</h2>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          Removes your email, password, connected providers, name, handle, bio and picture.{" "}
          <strong className="text-ink-800 dark:text-ink-200">This cannot be undone.</strong>
        </p>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
          Published posts stay up, credited to <em>Deleted member</em>. Tournament results stay
          under the handle you played as.
        </p>

        <form method="post" action="/auth/erase" className="mt-5 space-y-3">
          <label htmlFor="confirm" className="block text-sm font-medium">
            Type DELETE to confirm
          </label>
          <input
            id="confirm"
            name="confirm"
            required
            autoComplete="off"
            pattern="[Dd][Ee][Ll][Ee][Tt][Ee]"
            className="w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-red-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Delete my account, permanently
          </button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm">
        <Link
          href="/dashboard/profile"
          className="text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          Back to your profile
        </Link>
      </p>
    </AuthShell>
  );
}
