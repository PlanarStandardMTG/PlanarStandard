import type { OracleId } from "@ps/contracts";
import { resolveCardName } from "@ps/core";
import { listUnmatchedCardNames } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";

/**
 * The decklist names that never matched a card, sorted by whether the card
 * data deployed now knows them (E20.56). Exact matches only: a fuzzy guess
 * would put a card nobody registered into their deck.
 */
export interface CardMatches {
  readonly matches: readonly { readonly name: string; readonly oracleId: OracleId }[];
  readonly unmatched: readonly string[];
}

export async function findCardMatches(service: SupabaseClient): Promise<CardMatches> {
  const index = cardIndex();
  const matches: { name: string; oracleId: OracleId }[] = [];
  const unmatched: string[] = [];
  for (const name of await listUnmatchedCardNames(service)) {
    const resolved = resolveCardName(name, index);
    if (resolved.ok) matches.push({ name, oracleId: resolved.oracleId });
    else unmatched.push(name);
  }
  return { matches, unmatched };
}
