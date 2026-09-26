import { describe, expect, it } from "vitest";

import { readDecklistSheet } from "./index";

const entries = [
  { playerId: "p1", displayName: "Zaunus 13", handles: ["Zaunus13", "zaunus_melee"] },
  { playerId: "p2", displayName: "Sunsett", handles: ["sunsett"] },
  { playerId: "p3", displayName: "Twin", handles: ["same"] },
  { playerId: "p4", displayName: "Other twin", handles: ["Same"] },
];

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("core/results/decklist-sheet", () => {
  it("reads a header in any order, and matches a name by any handle, ignoring punctuation", () => {
    const sheet = readDecklistSheet(
      [
        ["Deck", "Player", "Archetype"],
        ["4 Shock; 4 Opt", "zaunus-13", " Izzet Tempo "],
        [`https://planarstandard.com/decks/${ID}`, "ZAUNUS_MELEE"],
        [ID.toUpperCase(), "Sunsett"],
      ],
      entries,
    );
    expect(sheet.decks).toEqual([
      { playerId: "p1", deck: { kind: "text", text: "4 Shock\n4 Opt" }, archetype: "Izzet Tempo" },
      { playerId: "p2", deck: { kind: "saved", deckId: ID } },
    ]);
    expect(sheet.issues).toEqual([{ row: 3, message: expect.stringMatching(/earlier row/) }]);
  });

  it("takes the first two columns when there is no header, keeping a multi-line list", () => {
    const sheet = readDecklistSheet([["Sunsett", "4 Shock\n\nSideboard\n2 Duress"]], entries);
    expect(sheet.decks).toEqual([
      { playerId: "p2", deck: { kind: "text", text: "4 Shock\n\nSideboard\n2 Duress" } },
    ]);
  });

  it("says why a row was not used, and skips a blank one", () => {
    const sheet = readDecklistSheet(
      [
        ["player", "deck"],
        ["Nobody", "4 Shock"],
        ["same", "4 Shock"],
        ["Sunsett", "https://moxfield.com/decks/abc"],
        ["", ""],
        ["Zaunus13", ""],
      ],
      entries,
    );
    expect(sheet.decks).toEqual([]);
    expect(sheet.issues.map((issue) => issue.row)).toEqual([2, 3, 4, 6]);
    expect(sheet.issues[2]?.message).toMatch(/on this site/);
  });
});
