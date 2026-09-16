import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseFilename } from "./index";

const FILENAMES = readFileSync(
  new URL("../../../../fixtures/decklists/filenames.txt", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter((line) => line.trim().length > 0);

describe("core/decklist/parse-filename", () => {
  it("reads the canonical fullwidth-pipe form", () => {
    expect(parseFilename("Sunsett｜Abzan Pile｜Abzan Midrange｜3-0-0｜6-1.txt")).toEqual({
      player: "Sunsett",
      deckName: "Abzan Pile",
      archetype: "Abzan Midrange",
      matchRecord: { wins: 3, losses: 0, draws: 0 },
      gameRecord: { wins: 6, losses: 1 },
    });
  });

  it("accepts the separator the OS rewrote to an underscore", () => {
    expect(parseFilename("BasscannonTtonka_Jeskai Prowess_Jeskai Prowess_3-1-0_7-4.txt")).toEqual({
      player: "BasscannonTtonka",
      deckName: "Jeskai Prowess",
      archetype: "Jeskai Prowess",
      matchRecord: { wins: 3, losses: 1, draws: 0 },
      gameRecord: { wins: 7, losses: 4 },
    });
  });

  it("surfaces the trailing parenthetical alias as its own field", () => {
    // core/identity/signals/parenthetical (E9.2) reads this field directly.
    expect(
      parseFilename("Zaunus13 (LikoRS)｜Dragonstorm｜4c Dragons｜2-3-0｜7-7.txt"),
    ).toMatchObject({ player: "Zaunus13", alias: "LikoRS" });
  });

  it("finds the alias even with no space before the parenthesis", () => {
    expect(
      parseFilename("Oseoros(Rus)｜Quantum｜Mono Blue Quantum Tempo｜1-2-0｜2-4.txt"),
    ).toMatchObject({ player: "Oseoros", alias: "Rus" });
  });

  it("omits the alias when there is none", () => {
    const meta = parseFilename("Sunsett｜Abzan Pile｜Abzan Midrange｜3-0-0｜6-1.txt");
    expect("alias" in meta).toBe(false);
  });

  it("tolerates a missing trailing segment", () => {
    expect(parseFilename("Danu｜Gruul｜Gruul Aggro｜2-2-0.txt")).toEqual({
      player: "Danu",
      deckName: "Gruul",
      archetype: "Gruul Aggro",
      matchRecord: { wins: 2, losses: 2, draws: 0 },
    });
  });

  it("identifies records by shape, so a missing archetype does not shift them", () => {
    // Four segments, but the last two are records — so "Mono Red" is the deck
    // name and there is no archetype, rather than "3-0-0" becoming the archetype.
    expect(parseFilename("100beep｜Mono Red｜3-0-0｜6-2.txt")).toEqual({
      player: "100beep",
      deckName: "Mono Red",
      matchRecord: { wins: 3, losses: 0, draws: 0 },
      gameRecord: { wins: 6, losses: 2 },
    });
  });

  it("leaves a fullwidth > inside a segment alone", () => {
    expect(
      parseFilename("Boxxy｜Golgari＞Midrange｜Golgari Midrange｜1-3-0｜3-6.txt"),
    ).toMatchObject({ deckName: "Golgari＞Midrange", archetype: "Golgari Midrange" });
  });

  it("distinguishes a match record from a game record by its draw component", () => {
    const meta = parseFilename("C0d3 (c0d33)｜Orzhov｜Orzhov Aristocrats｜4-0-0｜8-1.txt");
    expect(meta.matchRecord).toEqual({ wins: 4, losses: 0, draws: 0 });
    expect(meta.gameRecord).toEqual({ wins: 8, losses: 1 });
    expect("draws" in (meta.gameRecord ?? {})).toBe(false);
  });

  it("copes with a bare player name and nothing else", () => {
    expect(parseFilename("serlupidus.txt")).toEqual({ player: "serlupidus" });
    expect(parseFilename("serlupidus")).toEqual({ player: "serlupidus" });
  });

  it("parses every filename in the fixture corpus without throwing", () => {
    expect(FILENAMES.length).toBeGreaterThan(5);
    for (const name of FILENAMES) {
      const meta = parseFilename(name);
      expect(meta.player.length).toBeGreaterThan(0);
      expect(meta.player).not.toContain("(");
      expect(meta.player).not.toContain(".txt");
    }
  });

  it("finds an alias on exactly the four fixture names that carry one", () => {
    const withAlias = FILENAMES.map(parseFilename).filter((m) => m.alias !== undefined);
    expect(withAlias.map((m) => m.alias).sort()).toEqual(["LikoRS", "Mika", "Rus", "c0d33"]);
  });
});
