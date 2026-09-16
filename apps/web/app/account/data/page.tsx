import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, Card, Notice } from "@/components/auth/form-parts";
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
  confirm: "You have to type DELETE to confirm. Nothing was changed.",
};

export default async function AccountDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const raw = typeof params["error"] === "string" ? params["error"] : null;
  const error = raw === null ? null : (ERRORS[raw] ?? "That did not work.");

  return (
    <AuthShell
      title="Your data"
      intro="What this site holds about you, how to take a copy, and how to remove yourself."
    >
      {error !== null && <Notice tone="warn">{error}</Notice>}

      <Card className="mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">What we hold</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-ink-400">
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Your email address</strong>, used to
            sign you in and nothing else. It is never shown on the site.
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Your display name, handle, and
            bio</strong> — these are your byline, and they are public.
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Anything you have written or
            submitted</strong>: articles, decks.
          </li>
          <li>
            <strong className="text-ink-800 dark:text-ink-200">Sign-in records</strong>, kept by our
            authentication provider.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
          We do not store your password — only a hash, which cannot be read back. There is no
          advertising and no analytics on this site, and nothing about you is sold or shared. The
          full detail is in the{" "}
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
        <h2 className="font-serif text-lg font-semibold">Take a copy</h2>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          A JSON file with your profile, your articles including unpublished drafts, and your decks.
          It also lists what is held elsewhere and how to ask for it.
        </p>
        <a
          href="/account/data/export"
          className="mt-4 inline-block rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
        >
          Download my data
        </a>
      </Card>

      <Card className="mt-6 border-red-300 p-6 dark:border-red-900">
        <h2 className="font-serif text-lg font-semibold">Delete your account</h2>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          This removes your email address, your password, every provider you have connected, and
          your name, handle, bio, and picture. It cannot be undone, and{" "}
          <strong className="text-ink-800 dark:text-ink-200">we cannot get any of it back</strong>.
        </p>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
          Anything you published stays up with the byline changed to{" "}
          <em>Deleted member</em> — an article the community is still reading is not removed when
          its author leaves. Tournament results stay too: they are recorded against the handle you
          played under rather than against this account, and they came from the organiser&rsquo;s
          own platform. Download a copy first if you want one.
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
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
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
          href="/profile"
          className="text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          Back to {viewer.profile.displayName}&rsquo;s profile
        </Link>
      </p>
    </AuthShell>
  );
}
