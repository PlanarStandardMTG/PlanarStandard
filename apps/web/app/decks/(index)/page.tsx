import type { Metadata } from "next";
import { latestVersions } from "@ps/core";
import { listMemberDecks } from "@ps/db";
import Link from "next/link";

import { FORMAT_LABELS } from "@/components/decks/format-labels";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format-date";
import { load } from "@/lib/load";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decks",
  description: "Import a decklist, see it card by card, and check it against the current format.",
};

const BUTTON =
  "inline-block shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white " +
  "hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * A member's own decks (E20.28), each at its latest version (E20.30). The public
 * browse page is E20.6's listing, later.
 */
export default async function DecksPage() {
  const viewer = await currentViewer();

  return (
    <Container className="py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Decks</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            Import a list, see it card by card, and check it against the current format.
          </p>
        </div>
        {viewer === null ? (
          <Link href={loginHref("/decks/new")} className={BUTTON}>
            Sign in to import a deck
          </Link>
        ) : viewer.profile.bannedAt === null ? (
          <Link href="/decks/new" className={BUTTON}>
            Import a deck
          </Link>
        ) : null}
      </header>

      {viewer !== null && <OwnDecks ownerId={viewer.profile.id} />}
    </Container>
  );
}

async function OwnDecks({ ownerId }: { ownerId: Parameters<typeof listMemberDecks>[1] }) {
  const decks = await load(async () => listMemberDecks(await createSessionClient(), ownerId));
  if (!decks.ok) return <ErrorState title="Your decks could not be loaded" detail={decks.error} />;
  if (decks.value.length === 0) {
    return <EmptyState title="No decks yet">Imported decks will be listed here.</EmptyState>;
  }

  return (
    <section aria-labelledby="own-decks">
      <h2 id="own-decks" className="mb-3 text-sm font-medium text-ink-500 dark:text-ink-400">
        Your decks
      </h2>
      <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
        {latestVersions(decks.value).map(({ deck, versions }) => (
          <li key={deck.id}>
            <Link
              href={`/decks/${deck.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
            >
              <span className="font-medium">{deck.name}</span>
              <span className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span>{FORMAT_LABELS[deck.format]}</span>
                {versions > 1 && <span>{versions} versions</span>}
                {deck.visibility !== "public" && (
                  <Badge variant="outline" className="capitalize">
                    {deck.visibility}
                  </Badge>
                )}
                {formatDate(deck.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
