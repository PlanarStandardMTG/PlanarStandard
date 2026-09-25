"use server";

import { cardIndex } from "@/lib/cards/card-index";
import type { DeckId } from "@ps/contracts";
import { checkDeckImport, type DeckImportProblem } from "@ps/core";
import { createMemberDeck, deleteMemberDeck, getCurrentFormatVersion } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Import and delete a member's own deck (E20.28). The owner is always the
 * session's, and `decks_member_insert` checks it again underneath.
 */
export interface ImportState {
  readonly problems: readonly DeckImportProblem[];
}

export async function importDeck(_previous: ImportState, form: FormData): Promise<ImportState> {
  await requireRole("reader");
  const text = (name: string) => form.get(name)?.toString() ?? "";
  const decklist = text("decklist");

  const check = checkDeckImport(
    { name: text("name"), visibility: text("visibility"), decklist },
    cardIndex(),
  );
  if (!check.ok) return { problems: check.problems };

  const supabase = await createSessionClient();
  const format = await getCurrentFormatVersion(supabase);
  const { name, visibility, deck } = check.value;

  const id = await createMemberDeck(
    supabase,
    { name, visibility, rawImport: decklist, formatVersionId: format?.id ?? null },
    deck.cards.map((card) => ({
      oracleId: card.oracleId,
      name: card.name,
      quantity: card.qty,
      board: card.board,
      set: card.set ?? null,
      collector: card.collector ?? null,
    })),
  );

  revalidatePath("/decks");
  redirect(`/decks/${id}`);
}

export async function deleteDeck(form: FormData): Promise<void> {
  await requireRole("reader");
  const id = form.get("id")?.toString() ?? "";
  await deleteMemberDeck(await createSessionClient(), id as DeckId);
  revalidatePath("/decks");
  redirect("/decks");
}
