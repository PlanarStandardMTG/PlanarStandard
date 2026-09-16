import type { EventPodium } from "@ps/contracts";

/**
 * A stand-in podium, until the results ledger exists.
 *
 * Nothing in the repository can answer "who won the last event" yet: `decks` is
 * E13.7 and the results ledger is E13.8, so there is no table to read. This is
 * the shape those tables will produce, filled in by hand so the section can be
 * designed and reviewed now rather than after the schema lands.
 *
 * It is drawn from real Season II material rather than invented:
 *
 * - The event is the seeded `planar-standard-weekly-40` (E13.6's seed), so the
 *   name, date, link and player count agree with the row already in the database.
 * - The handles are the ones the fixtures use throughout — `serlupidus`,
 *   `Sunsett`, `Zaunus13`, `c0d33`.
 * - The archetypes are the five in `seed/0005_archetypes.sql`, with the colour
 *   identity each row already carries.
 * - Every card named here appears in a real Season II decklist in
 *   `fixtures/archetype-map/season-ii-excerpt.expected.json`, so none of them is
 *   a card that does not exist or is not in the pool.
 *
 * The **results** are made up. That is why `loadLatestPodium` reports this as a
 * sample and the section says so on the page: a fabricated standing shown as a
 * real one is the single thing a site about metagame data cannot do, and a
 * placeholder is not an exception to that.
 */
export const SAMPLE_PODIUM: EventPodium = {
  name: "Planar Standard Weekly #40",
  slug: "planar-standard-weekly-40",
  date: "2026-08-22",
  platform: "Challonge",
  externalUrl: "https://challonge.com/ps_weekly_40",
  playerCount: 31,
  finishes: [
    {
      placement: 1,
      handle: "Sunsett",
      archetype: "Abzan Midrange",
      deckName: "Zenith Abzan",
      deckId: null,
      record: { wins: 5, losses: 0, draws: 0 },
      colors: ["W", "B", "G"],
      keyCards: ["Cosmogrand Zenith", "Ouroboroid", "Severance Priest"],
    },
    {
      placement: 2,
      handle: "serlupidus",
      archetype: "4c Dragons",
      deckName: "Dragonstorm",
      deckId: null,
      record: { wins: 4, losses: 1, draws: 0 },
      colors: ["W", "U", "B", "G"],
      keyCards: ["Bloomvine Regent", "Marang River Regent", "Dragonback Assault"],
    },
    {
      placement: 3,
      handle: "Zaunus13",
      archetype: "Azorius Control",
      deckName: null,
      deckId: null,
      record: { wins: 4, losses: 1, draws: 0 },
      colors: ["W", "U"],
      keyCards: ["Depressurize", "Emergency Eject", "Skyknight Squire"],
    },
    {
      placement: 4,
      handle: "c0d33",
      archetype: "Dimir Faeries",
      deckName: "Tempo Faeries",
      deckId: null,
      // A draw in the record, because `draws` being optional is a thing the
      // podium tile has to render and a 4-0 placeholder would never exercise.
      record: { wins: 3, losses: 1, draws: 1 },
      colors: ["U", "B"],
      keyCards: ["Sunset Saboteur", "Intimidation Tactics", "Duress"],
    },
  ],
};
