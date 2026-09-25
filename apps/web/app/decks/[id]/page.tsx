import type { Deck, DeckId } from "@ps/contracts";
import { getDeckWithCards, getProfile, listDeckVersions } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ColorPips } from "@/components/decks/color-pips";
import { DeckLegality } from "@/components/decks/deck-legality";
import { DeleteDeckButton } from "@/components/decks/delete-deck-button";
import { DeckSectionsGrid } from "@/components/decks/deck-sections-grid";
import { DeckSectionsList } from "@/components/decks/deck-sections-list";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { currentViewer } from "@/lib/auth/viewer";
import { buildDeckView, type DeckView } from "@/lib/decks/deck-view";
import { deckAsText } from "@/lib/decks/deck-text";
import { loadCurrentFormat } from "@/lib/format/current-format";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read as the visitor, so an owner sees their private deck and nobody else
 * does — `decks_owner_read` decides, not this page.
 */
const findDeck = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  return await getDeckWithCards(await createSessionClient(), id as DeckId);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const deck = await findDeck((await params).id);
  if (deck === null) return { title: "Deck not found" };
  return {
    title: deck.name,
    ...(deck.visibility === "public" ? {} : { robots: { index: false, follow: false } }),
  };
}

/**
 * One deck, card by card, checked against its format (E20.6), and every other
 * version of it (E20.30).
 */
export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const { id } = await params;
  const deck = await findDeck(id);
  if (deck === null) notFound();

  const session = await createSessionClient();
  const [viewer, format, owner, versions] = await Promise.all([
    currentViewer(),
    loadCurrentFormat(),
    deck.ownerId === null ? null : getProfile(session, deck.ownerId),
    listDeckVersions(session, deck.id),
  ]);
  const view: DeckView = buildDeckView(deck, format.ok ? format.value : null);
  const isOwner = viewer !== null && viewer.profile.id === deck.ownerId;
  const latest = versions.at(-1) ?? deck;
  const isLatest = latest.id === deck.id;
  const showImages = (await searchParams).layout === "images";

  return (
    <Container className="py-12">
      <Link
        href="/decks"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Decks
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 pb-6 dark:border-ink-800">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{deck.name}</h1>
            {deck.visibility !== "public" && (
              <Badge variant="outline" className="capitalize">
                {deck.visibility}
              </Badge>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600 dark:text-ink-400">
            <span>
              {view.mainCount} cards
              {view.sideCount > 0 && ` · ${view.sideCount} sideboard`}
            </span>
            <DeckLegality format={deck.format} verdict={view.verdict} />
            <ColorPips colors={view.colors} />
            {owner !== null && <span>by {owner.displayName}</span>}
            <span>{formatDate(deck.createdAt)}</span>
          </p>
        </div>
        {isOwner && deck.lockedAt === null && (
          <div className="flex items-center gap-2">
            {isLatest && (
              <Link
                href={`/decks/${deck.id}/edit`}
                className={`${OUTLINE_BUTTON} hover:border-ink-500`}
              >
                Edit deck
              </Link>
            )}
            <DeleteDeckButton deckId={deck.id} deckName={deck.name} versions={versions.length} />
          </div>
        )}
      </header>

      {!isLatest && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          This is an earlier version of this deck.{" "}
          <Link href={`/decks/${latest.id}`} className="font-medium underline">
            See the latest
          </Link>
        </p>
      )}

      <div className="mb-4 flex justify-end">
        <Link
          href={showImages ? `/decks/${id}` : `/decks/${id}?layout=images`}
          scroll={false}
          className={`${OUTLINE_BUTTON} hover:border-ink-500`}
        >
          {showImages ? "Show as text" : "Show as images"}
        </Link>
      </div>

      {showImages ? (
        <DeckSectionsGrid sections={view.sections} />
      ) : (
        <DeckSectionsList sections={view.sections} />
      )}

      {versions.length > 1 && <VersionHistory versions={versions} current={deck.id} />}

      <details className="mt-12 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
        <summary className="cursor-pointer text-sm font-medium">Decklist as text</summary>
        <pre className="mt-3 overflow-x-auto text-sm">{deckAsText(deck.cards)}</pre>
      </details>

      <p className="mt-8 text-xs text-ink-500 dark:text-ink-400">
        Card images courtesy of{" "}
        <a href="https://scryfall.com" className="underline">
          Scryfall
        </a>
        . Magic: The Gathering is © Wizards of the Coast.
      </p>
    </Container>
  );
}

function VersionHistory({ versions, current }: { versions: readonly Deck[]; current: DeckId }) {
  return (
    <section aria-labelledby="versions" className="mt-12">
      <h2 id="versions" className="mb-3 text-sm font-semibold">
        Version history ({versions.length})
      </h2>
      <ol className="divide-y divide-ink-200 rounded-xl border border-ink-200 text-sm dark:divide-ink-800 dark:border-ink-800">
        {[...versions].reverse().map((version, i) => (
          <li key={version.id}>
            <Link
              href={`/decks/${version.id}`}
              aria-current={version.id === current ? "page" : undefined}
              className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-ink-50 aria-[current=page]:font-medium dark:hover:bg-ink-900"
            >
              <span>
                Version {versions.length - i}
                {i === 0 && " (latest)"} · {version.name}
              </span>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                {formatDate(version.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
