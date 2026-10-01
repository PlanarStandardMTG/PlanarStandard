import type { OracleId } from "@ps/contracts";
import { resolveCardName } from "@ps/core";
import { listUnmatchedCardNames } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";

/**
 * The decklist names that never matched a card, sorted by whether the card
 * data deployed now knows them (E20.56). Only exact matches are made here: a
 * name it doesn't know carries the closest card as a suggestion, for an admin
 * to confirm (E20.57), because a fuzzy guess would put a card nobody
 * registered into their deck.
 */
export interface CardMatches {
  readonly matches: readonly { readonly name: string; readonly oracleId: OracleId }[];
  readonly unmatched: readonly {
    readonly name: string;
    readonly suggestion: { readonly oracleId: OracleId; readonly name: string } | null;
  }[];
}

export async function findCardMatches(service: SupabaseClient): Promise<CardMatches> {
  const index = cardIndex();
  const matches: { name: string; oracleId: OracleId }[] = [];
  const unmatched: CardMatches["unmatched"][number][] = [];
  for (const name of await listUnmatchedCardNames(service)) {
    const resolved = resolveCardName(name, index);
    if (resolved.ok) matches.push({ name, oracleId: resolved.oracleId });
    else {
      const closest = resolved.candidates[0];
      unmatched.push({
        name,
        suggestion:
          closest === undefined ? null : { oracleId: closest.oracleId, name: closest.name },
      });
    }
  }
  return { matches, unmatched };
}
