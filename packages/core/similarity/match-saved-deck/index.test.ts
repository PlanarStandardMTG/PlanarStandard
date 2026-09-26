import type { OracleId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { matchSavedDeck, type ListCard } from "./index";

const card = (name: string, quantity: number, board: ListCard["board"] = "main"): ListCard => ({
  oracleId: `oracle-${name}` as OracleId,
  name,
  quantity,
  board,
});

const spells = (names: string, board: ListCard["board"] = "main") =>
  names.split("").map((letter) => card(letter, 4, board));

const deck = (id: string, cards: readonly ListCard[]) => ({ id, cards });

describe("core/similarity/match-saved-deck", () => {
  const list = [...spells("abcdefghij"), card("Island", 20), ...spells("xyz", "side")];

  it("finds the saved deck with exactly the same cards, in any order", () => {
    const saved = [deck("other", spells("klmnopqrst")), deck("same", [...list].reverse())];
    expect(matchSavedDeck(list, saved)).toEqual({ exact: saved[1], closest: null });
  });

  it("is not exact when only the sideboard or the basics differ, but is still closest", () => {
    const tuned = deck("tuned", [
      ...spells("abcdefghij"),
      card("Island", 19),
      ...spells("xy", "side"),
    ]);
    const match = matchSavedDeck(list, [tuned]);
    expect(match.exact).toBeNull();
    expect(match.closest).toEqual({ deck: tuned, similarity: 1 });
  });

  it("picks the nearest version, and nothing below the threshold", () => {
    const near = deck("near", spells("abcdefghik"));
    const far = deck("far", spells("abcklmnopq"));
    expect(matchSavedDeck(list, [far, near]).closest?.deck).toBe(near);
    expect(matchSavedDeck(list, [far]).closest).toBeNull();
  });

  it("matches a card that did not resolve by its name", () => {
    const unknown = { oracleId: null, name: "Mystery Card", quantity: 1, board: "main" as const };
    const saved = deck("mine", [...list, { ...unknown, name: "mystery  card" }]);
    expect(matchSavedDeck([...list, unknown], [saved]).exact).toBe(saved);
  });
});
