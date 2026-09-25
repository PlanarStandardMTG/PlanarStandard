import type { IdentityId, ParsedMatch } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { ledgerMatches } from "./index";

const identities = new Map([
  ["alice", "i-alice" as IdentityId],
  ["bob", "i-bob" as IdentityId],
]);

const parsed = (over: Partial<ParsedMatch>): ParsedMatch => ({
  rowIndex: 0,
  raw: {},
  p1Handle: "alice",
  p2Handle: "bob",
  result: "p1_win",
  ...over,
});

describe("core/results/ledger-matches", () => {
  it("turns a pairing into a ledger row on identities", () => {
    const { matches, issues } = ledgerMatches(
      [parsed({ round: 4, p1Games: 2, p2Games: 1, gameDraws: 0, isElimination: true })],
      identities,
    );

    expect(issues).toEqual([]);
    expect(matches).toEqual([
      {
        sourceImportId: null,
        round: 4,
        tableNumber: null,
        p1IdentityId: "i-alice",
        p2IdentityId: "i-bob",
        p1Games: 2,
        p2Games: 1,
        gameDraws: 0,
        result: "p1_win",
        isElimination: true,
      },
    ]);
  });

  it("keeps a bye as a bye, with no opponent", () => {
    const { matches } = ledgerMatches(
      [{ rowIndex: 0, raw: {}, p1Handle: "alice", result: "bye" }],
      identities,
    );

    expect(matches[0]).toMatchObject({ p2IdentityId: null, result: "bye", round: 1 });
  });

  it("leaves out a match with no result rather than inventing one", () => {
    const { matches, issues } = ledgerMatches([parsed({ result: null, rowIndex: 7 })], identities);

    expect(matches).toEqual([]);
    expect(issues).toEqual([expect.objectContaining({ code: "no-result", rowIndex: 7 })]);
  });

  it("leaves out a match whose player has no identity", () => {
    const { matches, issues } = ledgerMatches([parsed({ p2Handle: "carol" })], identities);

    expect(matches).toEqual([]);
    expect(issues[0]?.code).toBe("unresolved-handle");
  });
});
