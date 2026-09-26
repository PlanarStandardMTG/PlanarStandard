import type { IsoDate } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { formatRecord, ordinal, tournamentEmbed, type TournamentEmbedData } from "./index";

const context = { origin: "https://example.test" };
const deckId = "3f2a0000-0000-4000-8000-000000000001";
const data: TournamentEmbedData = {
  name: "Monthly Championship Series - October 2026",
  date: "2026-10-04" as IsoDate,
  playerCount: 32,
  url: "https://melee.gg/Tournament/View/1",
  finishers: [
    { placement: 1, playerSlug: "pilot-7", name: "pilot-7", record: { wins: 6, losses: 0 } },
    {
      placement: 2,
      playerSlug: "owl",
      name: "Arcane Owl",
      record: { wins: 4, losses: 1, draws: 1 },
    },
  ],
  deck: { name: "Rakdos Midrange", cards: [{ quantity: 60, name: "Swamp", board: "main" }] },
};

describe("core/content/embed-tournament", () => {
  it("defaults to a top 4, and checks each attribute", () => {
    expect(tournamentEmbed.check({ slug: "monthly-october" })).toBeNull();
    expect(tournamentEmbed.check({})).toBe("needs a tournament slug");
    expect(tournamentEmbed.check({ slug: "Monthly October" })).toMatch(/slug/);
    expect(tournamentEmbed.check({ slug: "m", show: "top8" })).toMatch(/winner, top2 or top4/);
    expect(tournamentEmbed.check({ slug: "m", deck: "nope" })).toBe("deck must be a deck id");
    expect(tournamentEmbed.check({ slug: "m", player: "pilot-7" })).toMatch(/needs a deck/);
  });

  it("writes the event, then the finisher's deck under its own heading, for Reddit", () => {
    const text = tournamentEmbed.exportAs(
      "reddit",
      { slug: "m", show: "top2", deck: deckId, player: "pilot-7" },
      data,
      context,
    );
    expect(text).toBe(
      [
        "**[Monthly Championship Series - October 2026](https://melee.gg/Tournament/View/1)** · 4 October 2026 · 32 players",
        "",
        "- **1st** pilot-7 (6-0)\n- **2nd** Arcane Owl (4-1-1)",
        "",
        `**pilot-7's deck (1st):** [Rakdos Midrange](https://example.test/decks/${deckId}) · 60 cards`,
        "",
        "    60 Swamp",
      ].join("\n"),
    );
  });

  it("pairs a deck with the event when no finisher is named", () => {
    const text = tournamentEmbed.exportAs("reddit", { slug: "m", deck: deckId }, data, context);
    expect(text).toContain("**Deck:** [Rakdos Midrange]");
  });

  it("says so when the event reported no standings", () => {
    const text = tournamentEmbed.exportAs(
      "reddit",
      { slug: "m" },
      { ...data, finishers: [] },
      context,
    );
    expect(text).toContain("*No standings were reported for this event.*");
  });

  it("keeps Discord to a few lines", () => {
    expect(tournamentEmbed.exportAs("discord", { slug: "m", deck: deckId }, data, context)).toBe(
      [
        "**Monthly Championship Series - October 2026** · 4 October 2026 · 32 players",
        "1st pilot-7 (6-0) · 2nd Arcane Owl (4-1-1)",
        "https://melee.gg/Tournament/View/1",
        `Deck: **Rakdos Midrange** https://example.test/decks/${deckId}`,
      ].join("\n"),
    );
  });

  it("falls back to the slug and a deck link when nothing loaded", () => {
    expect(tournamentEmbed.exportAs("reddit", { slug: "m", deck: deckId }, null, context)).toBe(
      `**Tournament:** m\n\n[Decklist](https://example.test/decks/${deckId})`,
    );
  });

  it("names places and records the way standings do", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
    ]);
    expect(formatRecord({ wins: 3, losses: 1, draws: 0 })).toBe("3-1");
  });
});
