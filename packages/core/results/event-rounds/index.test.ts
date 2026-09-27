import { describe, expect, it } from "vitest";

import { eventRounds } from "./index";

const match = (round: number, isElimination = false, id = `${round}`) => ({
  id,
  round,
  isElimination,
});

describe("results/event-rounds", () => {
  it("groups matches into rounds in playing order, keeping each round's own order", () => {
    const rounds = eventRounds([match(2, false, "b"), match(1, false, "a"), match(2, false, "c")]);

    expect(rounds.map((r) => [r.label, r.matches.map((m) => m.id)])).toEqual([
      ["Round 1", ["a"]],
      ["Round 2", ["b", "c"]],
    ]);
  });

  it("names a cut round for how many players are left in it", () => {
    const cut = (round: number, count: number) =>
      Array.from({ length: count }, (_, i) => match(round, true, `${round}-${i}`));
    const rounds = eventRounds([match(1), ...cut(2, 8), ...cut(3, 4), ...cut(4, 2), ...cut(5, 1)]);

    expect(rounds.map((r) => r.label)).toEqual([
      "Round 1",
      "Top 16",
      "Quarterfinals",
      "Semifinals",
      "Final",
    ]);
  });

  it("numbers the Swiss from 1 whatever the ledger numbered it", () => {
    expect(eventRounds([match(3), match(5)]).map((r) => [r.round, r.label])).toEqual([
      [3, "Round 1"],
      [5, "Round 2"],
    ]);
  });

  it("is empty for an event with no matches", () => {
    expect(eventRounds([])).toEqual([]);
  });
});
