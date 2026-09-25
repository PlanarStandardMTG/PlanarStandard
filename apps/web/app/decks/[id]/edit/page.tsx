import type { DeckId } from "@ps/contracts";
import { getDeckWithCards, listDeckVersions } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeckEditorForm } from "@/components/decks/deck-editor-form";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth/guard";
import { deckAsText } from "@/lib/decks/deck-text";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit deck",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit a member's own deck (E20.30). Saving writes the next version rather than
 * changing this one, so only the latest version is edited: an earlier one
 * sends the member on to the latest.
 */
export default async function EditDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole("reader");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createSessionClient();
  const deck = await getDeckWithCards(supabase, id as DeckId);
  if (
    deck === null ||
    deck.ownerId !== viewer.profile.id ||
    deck.submittedVia !== "import" ||
    deck.lockedAt !== null ||
    deck.hiddenAt !== null
  ) {
    notFound();
  }

  const latest = (await listDeckVersions(supabase, deck.id)).at(-1);
  if (latest !== undefined && latest.id !== deck.id) redirect(`/decks/${latest.id}/edit`);

  return (
    <Container className="max-w-3xl py-12">
      <Link
        href={`/decks/${deck.id}`}
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> {deck.name}
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Edit deck</h1>
      <p className="mt-1 mb-8 text-sm text-ink-600 dark:text-ink-400">
        Saving keeps this version as it is and adds the new one to the deck’s history.
      </p>
      <DeckEditorForm
        parentId={deck.id}
        initial={{
          name: deck.name,
          visibility: deck.visibility,
          format: deck.format,
          decklist: deck.rawImport ?? deckAsText(deck.cards),
        }}
      />
    </Container>
  );
}
