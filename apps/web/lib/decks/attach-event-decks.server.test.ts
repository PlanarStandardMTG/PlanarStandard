import type { DeckId, IsoDate, PlayerId, ProfileId, Tournament } from "@ps/contracts";
import {
  createPlayerWithIdentity,
  getDeckWithCards,
  insertDeck,
  listNamedEntries,
  replaceTournamentEntries,
  saveSourcedTournament,
  setPlayerProfile,
} from "@ps/db";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { toDeckCards } from "@/lib/decks/deck-cards";
import { cardIndex } from "@/lib/cards/card-index";
import { readDecklist } from "@ps/core";

import { attachEventDecks } from "./attach-event-decks.server";

/**
 * Against a local Supabase (`pnpm db:start`); skipped without one. Everything
 * made carries a per-run tag and is deleted by id afterwards.
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
const tag = String(Date.now()).slice(-8);
/** Seeded Ines Quillfeather (`seed/0001_profiles.sql`); nothing else links them. */
const MEMBER = "11111111-1111-4111-8111-000000000004" as ProfileId;
/** From `seed/0006_seasons.sql`. */
const SEASON_II = "44444444-4444-4444-8444-000000000002";

const SAVED = "4 Opt\n20 Island\n\nSideboard\n2 Negate";
const OTHER = "4 Shock\n20 Mountain";

const made = { tournaments: [] as string[], players: [] as PlayerId[], decks: [] as string[] };

describe.skipIf(!reachable)("lib/decks/attach-event-decks", () => {
  afterAll(async () => {
    await service.from("tournament_entries").delete().in("player_id", made.players);
    const { data } = await service.from("decks").select("id").in("player_id", made.players);
    const decks = [...made.decks, ...(data ?? []).map((d) => d.id as string)];
    await service.from("decks").delete().in("id", decks);
    await service.from("tournaments").delete().in("id", made.tournaments);
    await service.from("players").delete().in("id", made.players);
  });

  it("uses the member's saved deck, makes one for anyone else, and re-runs as a no-op", async () => {
    const tournament = await saveSourcedTournament(service, {
      source: "melee",
      externalId: `vitest-decks-${tag}`,
      name: `Monthly Vitest ${tag}`,
      slug: `vitest-decks-${tag}`,
      eventDate: "2020-02-01" as IsoDate,
      seasonId: null,
      platform: "melee",
      externalUrl: null,
      structure: null,
      rounds: null,
      playerCount: null,
      isRated: false,
      inCardStats: false,
    });
    made.tournaments.push(tournament.id);
    const [member, stranger] = await Promise.all(
      ["Member", "Stranger"].map(async (name) => {
        const identity = await createPlayerWithIdentity(service, {
          displayName: `${name} ${tag}`,
          slug: `vitest-attach-${name.toLowerCase()}-${tag}`,
          platform: "melee",
          handle: `${name}${tag}`,
          source: "import_inferred",
        });
        made.players.push(identity.playerId);
        return identity.playerId;
      }),
    );
    if (member === undefined || stranger === undefined) throw new Error("no players");
    await setPlayerProfile(service, member, MEMBER);
    const standing = {
      matchWins: 1,
      matchLosses: 0,
      matchDraws: 0,
      gameWins: 2,
      gameLosses: 0,
      dropped: false,
    };
    await replaceTournamentEntries(service, tournament.id, [
      { playerId: member, placement: 1, ...standing },
      { playerId: stranger, placement: 2, ...standing },
    ]);
    const saved = await insertDeck(
      service,
      {
        name: "My saved deck",
        ownerId: MEMBER,
        playerId: null,
        seasonId: null,
        format: "planar_standard",
        formatVersionId: null,
        archetypeId: null,
        archetypeRaw: null,
        visibility: "public",
        descriptionMarkdown: null,
        sourceUrl: null,
        rawImport: SAVED,
        submittedVia: "import",
        lockedAt: null,
        parentDeckId: null,
        isLegal: null,
        validation: null,
        hiddenAt: null,
      },
      toDeckCards(readDecklist(SAVED, cardIndex()).deck),
    );
    made.decks.push(saved.id);

    const lists = [
      {
        playerId: member,
        deck: { kind: "text" as const, text: "20 Island\n4 Opt\nSideboard\n2 Negate" },
      },
      { playerId: stranger, deck: { kind: "text" as const, text: OTHER }, name: "Red" },
    ];
    expect(await attachEventDecks(service, tournament, lists, "registration")).toMatchObject({
      attached: 2,
      unchanged: 0,
      problems: [],
    });
    const decks = async () =>
      Object.fromEntries(
        (await listNamedEntries(service, [tournament.id])).map((e) => [e.playerId, e.deckId]),
      );
    const first = await decks();
    expect(first[member]).toBe(saved.id);
    const made1 = await getDeckWithCards(service, first[stranger] as DeckId);
    expect(made1).toMatchObject({
      name: "Red",
      playerId: stranger,
      submittedVia: "registration",
      lockedAt: expect.stringMatching(/^2020-02-01/),
    });

    expect(await attachEventDecks(service, tournament, lists, "registration")).toMatchObject({
      attached: 0,
      unchanged: 2,
    });
    expect(await decks()).toEqual(first);

    // A changed list replaces the event's own copy, which goes.
    await attachEventDecks(
      service,
      tournament,
      [{ playerId: stranger, deck: { kind: "text", text: "4 Shock\n19 Mountain\n1 Opt" } }],
      "organizer",
    );
    expect((await decks())[stranger]).not.toBe(first[stranger]);
    expect(await getDeckWithCards(service, first[stranger] as DeckId)).toBeNull();
  });

  it("reuses the deck an earlier event made for the same player and list, in any season", async () => {
    const event = (n: number, seasonId: string | null) =>
      saveSourcedTournament(service, {
        source: "melee",
        externalId: `vitest-reuse-${n}-${tag}`,
        name: `Reuse ${n} ${tag}`,
        slug: `vitest-reuse-${n}-${tag}`,
        eventDate: `2020-03-0${n}` as IsoDate,
        seasonId: seasonId as Tournament["seasonId"],
        platform: "melee",
        externalUrl: null,
        structure: null,
        rounds: null,
        playerCount: null,
        isRated: false,
        inCardStats: false,
      });
    const [first, second, otherSeason] = await Promise.all([
      event(1, null),
      event(2, null),
      event(3, SEASON_II),
    ]);
    made.tournaments.push(first.id, second.id, otherSeason.id);
    const { playerId } = await createPlayerWithIdentity(service, {
      displayName: `Repeat ${tag}`,
      slug: `vitest-attach-repeat-${tag}`,
      platform: "melee",
      handle: `Repeat${tag}`,
      source: "import_inferred",
    });
    made.players.push(playerId);

    const deckAt = async (tournament: Tournament, text: string) => {
      await replaceTournamentEntries(service, tournament.id, [
        {
          playerId,
          placement: 1,
          matchWins: 3,
          matchLosses: 1,
          matchDraws: 0,
          gameWins: 6,
          gameLosses: 2,
          dropped: false,
        },
      ]);
      await attachEventDecks(
        service,
        tournament,
        [{ playerId, deck: { kind: "text", text } }],
        "registration",
      );
      return (await listNamedEntries(service, [tournament.id]))[0]?.deckId;
    };

    const original = await deckAt(first, OTHER);
    expect(await deckAt(second, "20 Mountain\n4 Shock")).toBe(original);
    expect(await deckAt(otherSeason, OTHER)).toBe(original);
    expect(await deckAt(otherSeason, SAVED)).not.toBe(original);
  });
});
