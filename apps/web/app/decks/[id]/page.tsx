import type { DeckId } from "@ps/contracts";
import { getDeckWithCards, getProfile } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ColorPips } from "@/components/decks/color-pips";
import { DeckLegality } from "@/components/decks/deck-legality";
import { DeckSectionsGrid } from "@/components/decks/deck-sections-grid";
import { DeckSectionsList } from "@/components/decks/deck-sections-list";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { currentViewer } from "@/lib/auth/viewer";
import { buildDeckView, type DeckView } from "@/lib/decks/deck-view";
import { loadCurrentFormat } from "@/lib/format/current-format";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { deleteDeck } from "../actions";

export const dynamic = "force-dynamic";

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

/** One deck, card by card, checked against the format in force (E20.6). */
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

  const [viewer, format, owner] = await Promise.all([
    currentViewer(),
    loadCurrentFormat(),
    deck.ownerId === null ? null : getProfile(await createSessionClient(), deck.ownerId),
  ]);
  const view: DeckView = buildDeckView(deck, format.ok ? format.value : null);
  const isOwner = viewer !== null && viewer.profile.id === deck.ownerId;
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
            <ColorPips colors={view.colors} />
            {owner !== null && <span>by {owner.displayName}</span>}
            <span>{formatDate(deck.createdAt)}</span>
          </p>
        </div>
        {isOwner && deck.lockedAt === null && (
          <form action={deleteDeck}>
            <input type="hidden" name="id" value={deck.id} />
            <button
              type="submit"
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 hover:border-red-400 hover:text-red-700 dark:border-ink-700 dark:text-ink-300 dark:hover:text-red-400"
            >
              Delete deck
            </button>
          </form>
        )}
      </header>

      <DeckLegality
        verdict={view.verdict}
        formatName={format.ok ? format.value?.version.name : undefined}
      />

      <div className="mt-10 mb-4 flex justify-end">
        <Link
          href={showImages ? `/decks/${id}` : `/decks/${id}?layout=images`}
          scroll={false}
          className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 hover:border-ink-500 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500"
        >
          {showImages ? "Show as text" : "Show as images"}
        </Link>
      </div>

      {showImages ? (
        <DeckSectionsGrid sections={view.sections} />
      ) : (
        <DeckSectionsList sections={view.sections} />
      )}

      <details className="mt-12 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
        <summary className="cursor-pointer text-sm font-medium">Decklist as text</summary>
        <pre className="mt-3 overflow-x-auto text-sm">{asText(deck.cards)}</pre>
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

function asText(cards: Parameters<typeof buildDeckView>[0]["cards"]): string {
  const lines = (board: string) =>
    cards.filter((c) => c.board === board).map((c) => `${c.quantity} ${c.name}`);
  const side = lines("side");
  return [...lines("main"), ...(side.length > 0 ? ["", "Sideboard", ...side] : [])].join("\n");
}
