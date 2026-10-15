import { listFormatVersions } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { DeckEditorForm, type DeckSaver } from "@/components/decks/deck-editor-form";
import { formatChoice, formatOptions } from "@/components/decks/format-labels";
import { Container } from "@/components/ui/container";
import { currentViewer } from "@/lib/auth/viewer";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return (await currentViewer()) === null
    ? {
        title: "Check a deck",
        description: "Paste a decklist and check it against the Planar Standard card pool.",
      }
    : { title: "Import a deck", robots: { index: false, follow: false } };
}

/**
 * Paste a text list (E20.28, E20.30). Other list formats arrive as adapters later.
 * Open to visitors, who can check a list but must sign in to save it (E20.59).
 */
export default async function NewDeckPage() {
  const viewer = await currentViewer();
  const saver: DeckSaver =
    viewer === null ? "visitor" : viewer.profile.bannedAt === null ? "member" : "banned";
  const versions = await listFormatVersions(createPublicClient());

  return (
    <Container className="max-w-3xl py-12">
      <Link
        href={saver === "visitor" ? "/decks" : "/decks?view=mine"}
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> {saver === "visitor" ? "Decks" : "Your decks"}
      </Link>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
        {saver === "member" ? "Import a deck" : "Check a deck"}
      </h1>
      <p className="mt-1 mb-8 text-sm text-ink-600 dark:text-ink-400">
        {saver === "member"
          ? "Paste a list from Arena, MTGO or a text file. It is checked as you type; illegal decks can still be saved."
          : "Paste a list from Arena, MTGO or a text file. It is checked against the format as you type."}
      </p>
      <DeckEditorForm
        saver={saver}
        formats={formatOptions(versions)}
        initial={{
          name: "",
          visibility: "public",
          format: formatChoice(null, versions),
          decklist: "",
        }}
      />
    </Container>
  );
}
