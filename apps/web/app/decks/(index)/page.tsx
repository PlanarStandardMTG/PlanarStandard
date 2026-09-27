import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

import { BrowseDecks } from "./browse-decks";
import { YourDecks } from "./your-decks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decks",
  description:
    "Browse the format's public decks, or import your own and check it against the format.",
};

const TABS = [
  { label: "Browse", href: "/decks", view: "browse" },
  { label: "Your decks", href: "/decks?view=mine", view: "mine" },
] as const;

const BUTTON =
  "inline-block shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white " +
  "hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * Two tabs: every public deck, filtered and paged (E20.40), and a member's own
 * decks at their latest versions (E20.28, E20.30) with the events they played.
 */
export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params["view"] === "mine" ? "mine" : "browse";
  const viewer = await currentViewer();

  return (
    <Container className="py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Decks</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            {view === "browse"
              ? "The format's public decks, newest first."
              : "Import a list, see it card by card, and check it against the current format."}
          </p>
        </div>
        {view === "mine" &&
          (viewer === null ? (
            <Link href={loginHref("/decks/new")} className={BUTTON}>
              Sign in to import a deck
            </Link>
          ) : viewer.profile.bannedAt === null ? (
            <Link href="/decks/new" className={BUTTON}>
              Import a deck
            </Link>
          ) : null)}
      </header>

      <nav className="mb-6 flex gap-6 border-b border-ink-200 text-sm dark:border-ink-800">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={tab.href}
            aria-current={tab.view === view ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent py-3 text-ink-500 aria-[current=page]:border-gold-700 aria-[current=page]:font-semibold aria-[current=page]:text-ink-900 dark:text-ink-400 dark:aria-[current=page]:border-gold-400 dark:aria-[current=page]:text-ink-100"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "browse" ? (
        <BrowseDecks params={params} />
      ) : viewer === null ? (
        <EmptyState title="Sign in to see your decks">
          Decks you import, and the ones you played at events, are kept here.
        </EmptyState>
      ) : (
        <YourDecks profileId={viewer.profile.id} />
      )}
    </Container>
  );
}
