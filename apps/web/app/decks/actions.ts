"use server";

import { cardIndex } from "@/lib/cards/card-index";
import type { DeckFormat, DeckId, LegalityVerdict, ResolvedDeck } from "@ps/contracts";
import {
  DECK_FORMATS,
  checkDeckImport,
  checkDeckInFormat,
  readDecklist,
  type DeckImportProblem,
  type UnknownCard,
} from "@ps/core";
import {
  createMemberDeck,
  getCurrentFormatDetail,
  hideMemberDeckVersions,
  listDeckVersions,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { formatRules } from "@/lib/decks/deck-view";
import { createPublicClient } from "@/lib/supabase/server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Save, check and remove a member's own deck (E20.28, E20.30, E20.31). The owner is
 * always the session's, and `decks_member_insert` checks it again underneath.
 */

/** What the editor shows beside the list: what stops it saving, and what only needs a yes. */
export interface DraftCheck {
  readonly problems: readonly DeckImportProblem[];
  readonly unknownCards: readonly UnknownCard[];
  /** Null when a Planar Standard deck has no version in force to check against. */
  readonly verdict: LegalityVerdict | null;
}

export interface SaveState {
  readonly problems: readonly DeckImportProblem[];
  /** Set when the deck saves only once the member confirms it: not legal, or unknown cards. */
  readonly confirm: DraftCheck | null;
  readonly error: string | null;
}

async function verdictFor(deck: ResolvedDeck, format: DeckFormat) {
  const detail =
    format === "planar_standard" ? await getCurrentFormatDetail(createPublicClient()) : null;
  return {
    formatVersionId: detail?.version.id ?? null,
    verdict: checkDeckInFormat(deck, format, formatRules(detail), cardIndex()),
  };
}

const needsConfirming = (check: Omit<DraftCheck, "problems">) =>
  check.unknownCards.length > 0 || check.verdict?.legal === false;

export async function checkDraft(format: string, decklist: string): Promise<DraftCheck> {
  await requireRole("reader");
  const reading = readDecklist(decklist, cardIndex());
  const deckFormat = DECK_FORMATS.find((f) => f === format) ?? "planar_standard";
  const { verdict } = await verdictFor(reading.deck, deckFormat);
  return { problems: reading.problems, unknownCards: reading.unknownCards, verdict };
}

export async function saveDeck(_previous: SaveState, form: FormData): Promise<SaveState> {
  await requireRole("reader");
  const text = (name: string) => form.get(name)?.toString() ?? "";
  const decklist = text("decklist");
  const parentId = text("parent") === "" ? null : (text("parent") as DeckId);

  const check = checkDeckImport(
    { name: text("name"), visibility: text("visibility"), format: text("format"), decklist },
    cardIndex(),
  );
  if (!check.ok) return { problems: check.problems, confirm: null, error: null };

  const { name, visibility, format, deck, unknownCards } = check.value;
  const { formatVersionId, verdict } = await verdictFor(deck, format);
  if (needsConfirming({ unknownCards, verdict }) && text("confirmed") !== "yes") {
    return { problems: [], confirm: { problems: [], unknownCards, verdict }, error: null };
  }

  const supabase = await createSessionClient();
  if (parentId !== null) {
    const versions = await listDeckVersions(supabase, parentId);
    if (versions.at(-1)?.id !== parentId) {
      return {
        problems: [],
        confirm: null,
        error:
          "This deck has a newer version than the one you are editing. Open the latest and edit that.",
      };
    }
  }

  const id = await createMemberDeck(
    supabase,
    { name, visibility, format, rawImport: decklist, formatVersionId, parentDeckId: parentId },
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

/**
 * Remove the chosen versions from the member's decks (E20.31). They are hidden,
 * not deleted, and the member lands on the newest version left.
 */
export async function deleteDeckVersions(form: FormData): Promise<void> {
  await requireRole("reader");
  const deckId = form.get("id")?.toString() ?? "";
  const versionIds = form.getAll("version").map((value) => value.toString() as DeckId);
  if (versionIds.length === 0) redirect(`/decks/${deckId}`);

  const left = await hideMemberDeckVersions(
    await createSessionClient(),
    deckId as DeckId,
    versionIds,
  );
  revalidatePath("/decks");
  redirect(left === null ? "/decks" : `/decks/${left}`);
}
