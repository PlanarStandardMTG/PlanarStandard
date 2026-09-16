import type { DeckCard, DeckId, OracleId, PlayerId, SeasonId, SetCode } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import {
  getDeckWithCards,
  insertDeck,
  listDecksByPlayer,
  listPublicDecksBySeason,
  type NewDeck,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening, for the same reason as
 * `repos/events`: `db` is the one package allowed to need infrastructure, and
 * the zero-credential promise only holds if a missing instance is a skip.
 *
 * Every deck this suite writes is deleted afterwards, **by id**. A blanket
 * delete would be shorter and is a trap: vitest runs test files in parallel, so
 * a suite that clears a whole table clears it out from under whoever else is
 * using it. `decks` has no seed rows (E13.7) and nothing else writes one today,
 * which makes the blanket version work right up until something does.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/** See `repos/events` — deliberately not the production service-role variable name. */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: anonKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const client = createClient(url, anonKey);
const service = createClient(url, serviceKey);

/** From `seed/0006_seasons.sql`. A real season, so the foreign key holds. */
const SEASON_II = "44444444-4444-4444-8444-000000000002" as SeasonId;

const deck = (over: Partial<NewDeck> & { name: string }): NewDeck => ({
  ownerId: null,
  playerId: null,
  seasonId: SEASON_II,
  formatVersionId: null,
  archetypeId: null,
  archetypeRaw: null,
  visibility: "public",
  descriptionMarkdown: null,
  sourceUrl: null,
  rawImport: null,
  submittedVia: "import",
  lockedAt: null,
  parentDeckId: null,
  isLegal: null,
  validation: null,
  ...over,
});

const card = (over: Partial<DeckCard> & { name: string }): DeckCard => ({
  oracleId: null,
  quantity: 4,
  board: "main",
  set: null,
  collector: null,
  ...over,
});

/** Ids this suite created, so the cleanup can name them rather than the table. */
const created: string[] = [];

/** `insertDeck`, remembering what it made. Every test writes through this. */
async function write(
  newDeck: NewDeck,
  cards: readonly DeckCard[],
): Promise<Awaited<ReturnType<typeof insertDeck>>> {
  const stored = await insertDeck(service, newDeck, cards);
  created.push(stored.id);
  return stored;
}

describe.skipIf(!reachable)("repos/decks", () => {
  afterEach(async () => {
    if (created.length === 0) return;
    // `deck_cards` cascades from `decks`, so the list goes with it.
    await service.from("decks").delete().in("id", created);
    created.length = 0;
  });

  it("reads back what was written, mapped to the contract", async () => {
    const stored = await write(
      deck({
        name: "Zenith Abzan",
        archetypeRaw: "Abzan Midrange (Midrange)",
        rawImport: "4 Cosmogrand Zenith (EOE) 9",
      }),
      [
        card({
          name: "Cosmogrand Zenith",
          oracleId: "8f2b1c4d-5e6a-4071-9b8c-2d3e4f5a6b70" as OracleId,
          set: "EOE" as SetCode,
          collector: "9",
        }),
      ],
    );

    expect(stored).toMatchObject({
      name: "Zenith Abzan",
      seasonId: SEASON_II,
      visibility: "public",
      submittedVia: "import",
      archetypeRaw: "Abzan Midrange (Midrange)",
      rawImport: "4 Cosmogrand Zenith (EOE) 9",
    });
    expect(stored.cards).toEqual([
      {
        oracleId: "8f2b1c4d-5e6a-4071-9b8c-2d3e4f5a6b70",
        name: "Cosmogrand Zenith",
        quantity: 4,
        board: "main",
        set: "EOE",
        collector: "9",
      },
    ]);
  });

  it("keeps a card whose name did not resolve", async () => {
    // E18.10: the row survives with a null oracle_id and the deck is flagged.
    // Dropping the line would make the deck read as 59 cards and legal.
    const stored = await write(deck({ name: "Typo", isLegal: false }), [
      card({ name: "Llanowar Elfs", quantity: 4 }),
    ]);

    expect(stored.cards[0]?.oracleId).toBeNull();
    expect(stored.cards[0]?.name).toBe("Llanowar Elfs");
    expect(stored.isLegal).toBe(false);
  });

  it("orders the list maindeck, sideboard, command zone, then by name", async () => {
    const stored = await write(deck({ name: "Ordered" }), [
      card({ name: "Duress", board: "side" }),
      card({ name: "Ouroboroid" }),
      card({ name: "Bloomvine Regent" }),
      card({ name: "Depressurize", board: "side" }),
    ]);

    expect(stored.cards.map((c) => `${c.board}:${c.name}`)).toEqual([
      "main:Bloomvine Regent",
      "main:Ouroboroid",
      "side:Depressurize",
      "side:Duress",
    ]);
  });

  it("leaves no deck behind when the cards fail to write", async () => {
    // quantity 0 violates the check constraint, so the card insert fails after
    // the deck insert has already succeeded. A deck with no cards reads as an
    // empty deck everywhere, which is why this compensates rather than shrugging.
    await expect(
      insertDeck(service, deck({ name: "Doomed" }), [card({ name: "Duress", quantity: 0 })]),
    ).rejects.toThrow(/writing cards/);

    expect(await listPublicDecksBySeason(client, SEASON_II, 10)).toEqual([]);
  });

  it("lists a player's decks including the ones they did not publish", async () => {
    const { data } = await service
      .from("players")
      .insert({ display_name: "Sunsett", slug: `sunsett-${Date.now()}` })
      .select("id")
      .single();
    const playerId = (data as { id: string }).id as PlayerId;

    await write(deck({ name: "Listed", playerId }), []);
    await write(deck({ name: "Unlisted", playerId, visibility: "unlisted" }), []);

    const theirs = await listDecksByPlayer(client, playerId);
    expect(theirs.map((d) => d.name).sort()).toEqual(["Listed", "Unlisted"]);

    await service.from("players").delete().eq("id", playerId);
  });

  it("leaves unlisted and private decks out of a browse listing", async () => {
    await write(deck({ name: "Public" }), []);
    await write(deck({ name: "Unlisted", visibility: "unlisted" }), []);
    await write(deck({ name: "Private", visibility: "private" }), []);

    const browsable = await listPublicDecksBySeason(client, SEASON_II, 10);
    expect(browsable.map((d) => d.name)).toEqual(["Public"]);
  });

  it("still serves an unlisted deck by id, because that is what unlisted means", async () => {
    const unlisted = await write(deck({ name: "Shared by link", visibility: "unlisted" }), [
      card({ name: "Duress" }),
    ]);

    const fetched = await getDeckWithCards(client, unlisted.id);
    expect(fetched?.name).toBe("Shared by link");
    expect(fetched?.cards).toHaveLength(1);
  });

  it("hides a private deck and its cards from the public client", async () => {
    const priv = await write(deck({ name: "Mine", visibility: "private" }), [
      card({ name: "Duress" }),
    ]);

    expect(await getDeckWithCards(client, priv.id)).toBeNull();
    // The service-role client bypasses RLS, so this is what proves the rows are
    // there and the policy is what hid them, rather than the write having failed.
    expect((await getDeckWithCards(service, priv.id))?.cards).toHaveLength(1);
  });

  it("is null for a deck that does not exist", async () => {
    expect(
      await getDeckWithCards(client, "00000000-0000-4000-8000-000000000000" as DeckId),
    ).toBeNull();
  });
});
