import type { FormatVersionId } from "@ps/contracts";
import { bestFormat, readDecklist } from "@ps/core";
import { getFormatDetail } from "@ps/db";

import { cardIndex } from "@/lib/cards/card-index";
import { formatRules } from "@/lib/decks/deck-view";
import { createPublicClient } from "@/lib/supabase/server";

export type RunDeckCheck =
  | { readonly ok: false; readonly problem: "deck-empty" | "deck-long" | "deck-unreadable" }
  | { readonly ok: true; readonly isLegal: boolean | null };

/**
 * Reads an entrant's list and checks it against the run's format versions (E26.17,
 * E20.66): legal if it is legal in any of them. A list the parser cannot read is
 * refused; an illegal one is registered and flagged, because what to do about it is
 * the organizer's call.
 */
export async function checkRunDeck(
  text: string,
  formatVersionIds: readonly FormatVersionId[],
): Promise<RunDeckCheck> {
  const index = cardIndex();
  const reading = readDecklist(text, index);
  const problem = reading.problems[0];
  if (problem !== undefined) {
    return {
      ok: false,
      problem:
        problem.code === "empty"
          ? "deck-empty"
          : problem.code === "long"
            ? "deck-long"
            : "deck-unreadable",
    };
  }

  const client = createPublicClient();
  const details = await Promise.all(formatVersionIds.map((id) => getFormatDetail(client, id)));
  const rules = details.map(formatRules).filter((r) => r !== null);
  const best = bestFormat(reading.deck, rules, index);
  return {
    ok: true,
    isLegal: best === null ? null : best.legal && reading.unknownCards.length === 0,
  };
}
