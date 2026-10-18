import type { DeckId, FormatRules, FormatVersionId } from "@ps/contracts";
import { checkDeck, deckTraits } from "@ps/core";
import {
  getFormatDetail,
  listDeckIds,
  listDecksWithCards,
  listFormatVersions,
  saveDeckLegality,
  saveDeckTraits,
  setLegalityStale,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";
import { formatRules, toResolvedDeck } from "@/lib/decks/deck-view";

/**
 * Keeps `deck_traits` and `deck_legality` in step with the decks (E20.72), so
 * `/decks` reads them instead of every list and the card data on each visit.
 *
 * A saved deck is worked out as it is written. What the stored rows cannot see
 * is a format version's rules changing under them: a narrowing edit marks the
 * version stale for an admin to recheck, and a new or widened version is
 * rechecked when it is saved.
 */

/** Decks read at once; each brings its whole list. */
const BATCH = 100;

/** Work out and store these decks' traits, and their legality in every version. */
export async function refreshDecks(
  service: SupabaseClient,
  deckIds: readonly DeckId[],
): Promise<void> {
  if (deckIds.length === 0) return;
  await recheck(service, deckIds, await everyVersion(service), { traits: true });
}

/**
 * Every deck's traits and legality in every version, after which no version
 * is stale. What an admin runs once a version's rules narrowed.
 */
export async function recheckAllDecks(service: SupabaseClient): Promise<number> {
  const versions = await everyVersion(service);
  const deckIds = await listDeckIds(service);
  await recheck(service, deckIds, versions, { traits: true });
  await setLegalityStale(
    service,
    versions.map((rules) => rules.formatVersionId),
    false,
  );
  return deckIds.length;
}

/** Every deck's legality in one version: a new one, or one whose rules only widened. */
export async function recheckVersion(
  service: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<void> {
  const rules = formatRules(await getFormatDetail(service, formatVersionId));
  if (rules === null) return;
  await recheck(service, await listDeckIds(service), [rules], { traits: false });
  await setLegalityStale(service, [formatVersionId], false);
}

async function everyVersion(service: SupabaseClient): Promise<readonly FormatRules[]> {
  const details = await Promise.all(
    (await listFormatVersions(service)).map((version) => getFormatDetail(service, version.id)),
  );
  return details.flatMap((detail) => formatRules(detail) ?? []);
}

async function recheck(
  service: SupabaseClient,
  deckIds: readonly DeckId[],
  versions: readonly FormatRules[],
  { traits }: { readonly traits: boolean },
): Promise<void> {
  const index = cardIndex();
  for (let i = 0; i < deckIds.length; i += BATCH) {
    const decks = (await listDecksWithCards(service, { ids: deckIds.slice(i, i + BATCH) })).map(
      (deck) => ({ deckId: deck.id, deck: toResolvedDeck(deck) }),
    );
    if (traits) {
      await saveDeckTraits(
        service,
        decks.map(({ deckId, deck }) => ({ deckId, traits: deckTraits(deck, index) })),
      );
    }
    await saveDeckLegality(
      service,
      decks.flatMap(({ deckId, deck }) =>
        versions.map((rules) => ({
          deckId,
          formatVersionId: rules.formatVersionId,
          legal: checkDeck(deck, rules, index).legal,
        })),
      ),
    );
  }
}
