import type { Metadata } from "next";
import Link from "next/link";

import { DeckImportForm } from "@/components/decks/deck-import-form";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import a deck",
  robots: { index: false, follow: false },
};

/** Paste a text list (E20.28). Other formats arrive as adapters later. */
export default async function NewDeckPage() {
  await requireRole("reader");

  return (
    <Container className="max-w-3xl py-12">
      <Link
        href="/decks"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Your decks
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Import a deck</h1>
      <p className="mt-1 mb-8 text-sm text-ink-600 dark:text-ink-400">
        Paste a list from Arena, MTGO or a text file. Every card is matched against the sets in the
        card pool; the deck page then checks it against the current format.
      </p>
      <DeckImportForm />
    </Container>
  );
}
