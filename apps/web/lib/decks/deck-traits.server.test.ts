import type { DeckId, FormatVersionId } from "@ps/contracts";
import { checkDeck, readDecklist } from "@ps/core";
import {
  getDeckWithCards,
  getFormatDetail,
  insertDeck,
  listDeckTraits,
  listFormatVersions,
  listLegalDeckIds,
  listStaleLegalityVersions,
  setLegalityStale,
} from "@ps/db";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { cardIndex } from "@/lib/cards/card-index";
import { toDeckCards } from "@/lib/decks/deck-cards";
import { formatRules, toResolvedDeck } from "@/lib/decks/deck-view";

import { recheckVersion, refreshDecks } from "./deck-traits.server";

/**
 * Against a local Supabase (`pnpm db:start`); skipped without one. Decks are
 * deleted by id afterwards. Only one version is ever rechecked: a recheck of
 * them all would clear the flags `repos/format`'s suite is reading meanwhile.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: serviceKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const service = createClient(url, serviceKey);
/** The seeded special-event pool (`seed/0004_format.sql`). */
const GAUNTLET = "22222222-2222-4222-8222-000000000002" as FormatVersionId;

const made: DeckId[] = [];

async function deckOf(name: string, text: string): Promise<DeckId> {
  const deck = await insertDeck(
    service,
    {
      name,
      ownerId: null,
      playerId: null,
      seasonId: null,
      format: "planar_standard",
      formatVersionId: null,
      archetypeId: null,
      archetypeRaw: null,
      visibility: "public",
      descriptionMarkdown: null,
      sourceUrl: null,
      rawImport: text,
      submittedVia: "organizer",
      lockedAt: null,
      parentDeckId: null,
      isLegal: null,
      validation: null,
      hiddenAt: null,
    },
    toDeckCards(readDecklist(text, cardIndex()).deck),
  );
  made.push(deck.id);
  return deck.id;
}

describe.skipIf(!reachable)("lib/decks/deck-traits", () => {
  afterAll(async () => {
    await service.from("decks").delete().in("id", made);
  });

  it("stores a saved deck's traits, and its legality in every version as checked now", async () => {
    const red = await deckOf("Traits red", "4 Shock\n56 Mountain");
    const short = await deckOf("Traits short", "4 Shock");
    await refreshDecks(service, [red, short]);

    expect((await listDeckTraits(service, [red])).get(red)).toEqual({
      colors: ["R"],
      castColors: ["R"],
      cardNames: ["mountain", "shock"],
    });

    for (const version of await listFormatVersions(service)) {
      const rules = formatRules(await getFormatDetail(service, version.id));
      if (rules === null) continue;
      const legal = await listLegalDeckIds(service, version.id);
      for (const id of [red, short]) {
        const deck = await getDeckWithCards(service, id);
        if (deck === null) throw new Error("deck went missing");
        expect(legal.has(id)).toBe(checkDeck(toResolvedDeck(deck), rules, cardIndex()).legal);
      }
      expect(legal.has(short)).toBe(false);
    }
  });

  it("rechecks one version and marks it up to date", async () => {
    const red = await deckOf("Traits recheck", "4 Shock\n56 Mountain");
    await setLegalityStale(service, [GAUNTLET], true);

    await recheckVersion(service, GAUNTLET);

    expect((await listStaleLegalityVersions(service)).has(GAUNTLET)).toBe(false);
    const { data } = await service
      .from("deck_legality")
      .select("legal")
      .eq("deck_id", red)
      .eq("format_version_id", GAUNTLET);
    // The gauntlet is singleton and a hundred cards, so four Shocks never pass.
    expect(data).toEqual([{ legal: false }]);
  });
});
