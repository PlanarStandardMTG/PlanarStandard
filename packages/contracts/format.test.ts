import { describe, expect, expectTypeOf, it } from "vitest";
import type { OracleId, SetCode } from "./cards";
import type {
  CardIssue,
  DeckConstraints,
  DeckIssue,
  FormatCardRule,
  FormatRules,
  FormatVersion,
  FormatVersionDetail,
  Issue,
  IssueCode,
  LegalityVerdict,
} from "./format";

const oracleId = (id: string): OracleId => id as OracleId;
const setCode = (code: string): SetCode => code as SetCode;

const coriSteelCutter = oracleId("2bc5b3f4-5c16-4f1a-9d2e-0a71c8f4b3d9");
const bloomvineRegent = oracleId("6c1e9d40-7b2a-4f83-8d55-0a9e3c17b4f2");
const feedTheSwarm = oracleId("c9f3a2b1-5d84-4e07-9a6b-18f2c0d75e3a");
const blackLotus = oracleId("5089ec1a-f881-4d55-af14-5d996171203b");

const seasonTwoConstraints = {
  minMaindeck: 60,
  maxMaindeck: null,
  maxSideboard: 15,
  maxCopies: 4,
  singleton: false,
  extraRules: {},
} satisfies DeckConstraints;

const seasonTwo = {
  id: "0b8a4f2e-3d17-4c6b-8f09-7a2e5b1d4c63",
  name: "Season II",
  effectiveFrom: "2025-09-23",
  effectiveTo: null,
  notesMarkdown: null,
  isCurrent: true,
} satisfies FormatVersion;

const seasonTwoRules = {
  formatVersionId: seasonTwo.id,
  legalSets: new Set<SetCode>(["SOS", "ECL", "EOE", "TDM", "DFT", "FDN"]),
  cardRules: new Map<OracleId, FormatCardRule>([
    [
      coriSteelCutter,
      {
        oracleId: coriSteelCutter,
        ruling: "banned",
        reason: "Dominates every red deck in the field",
        effectiveFrom: "2026-01-12",
      },
    ],
  ]),
  constraints: seasonTwoConstraints,
} satisfies FormatRules;

describe("format contracts", () => {
  it("mirrors the current format_versions row, which has no end date", () => {
    expectTypeOf(seasonTwo).toExtend<FormatVersion>();
    expect(seasonTwo.effectiveTo).toBeNull();
    expect(seasonTwo.isCurrent).toBe(true);
  });

  it("mirrors a superseded version, which has an end date and B&R notes", () => {
    const seasonOne = {
      id: "f41d9e7c-6b30-4a88-91ce-2d5f8a03b7e1",
      name: "Season I",
      effectiveFrom: "2025-02-04",
      effectiveTo: "2025-09-22",
      notesMarkdown: "Rotated on the release of **SOS**.",
      isCurrent: false,
    } satisfies FormatVersion;

    expectTypeOf(seasonOne).toExtend<FormatVersion>();
    expect(seasonOne.isCurrent).toBe(false);
  });

  it("collapses sets, rulings, and constraints into one object the checkers can look up", () => {
    expectTypeOf(seasonTwoRules).toExtend<FormatRules>();
    expect(seasonTwoRules.legalSets.has("TDM")).toBe(true);
    expect(seasonTwoRules.legalSets.has("STA")).toBe(false);
    expect(seasonTwoRules.cardRules.get(coriSteelCutter)?.ruling).toBe("banned");
    expect(seasonTwoRules.constraints.maxMaindeck).toBeNull();
  });

  it("carries the copy limit of a restricted card", () => {
    const restricted = {
      oracleId: bloomvineRegent,
      ruling: "restricted",
      reason: null,
      effectiveFrom: null,
      limit: 1,
    } satisfies FormatCardRule;

    expectTypeOf<Extract<FormatCardRule, { ruling: "restricted" }>>().toExtend<{
      limit: number;
    }>();
    expect(restricted.limit).toBe(1);
  });

  it("lets a legal_exception name a card the set pool does not carry", () => {
    const exception = {
      oracleId: blackLotus,
      ruling: "legal_exception",
      reason: "Allowed for the anniversary cube event",
      effectiveFrom: "2026-03-01",
    } satisfies FormatCardRule;

    expectTypeOf(exception).toExtend<FormatCardRule>();
    expect(seasonTwoRules.legalSets.has("LEA")).toBe(false);
  });

  it("keeps the oracle id of an unresolved name null without dropping the line", () => {
    const unresolved = {
      kind: "card",
      code: "unresolved_name",
      cardName: "Bloomvine Regent / Claim Territory",
      oracleId: null,
      boards: ["main"],
      message: 'Could not resolve "Bloomvine Regent / Claim Territory".',
    } satisfies CardIssue;

    expectTypeOf(unresolved).toExtend<CardIssue>();
    expect(unresolved.oracleId).toBeNull();
  });

  it("names the card and the copies seen on a copy-limit issue, across both boards", () => {
    const overLimit = {
      kind: "card",
      code: "over_copy_limit",
      cardName: "Feed the Swarm",
      oracleId: feedTheSwarm,
      boards: ["main", "side"],
      copies: 6,
      limit: 4,
      message: "Feed the Swarm: 6 copies, limit 4.",
    } satisfies CardIssue;

    expectTypeOf(overLimit).toExtend<CardIssue>();
    expect(overLimit.copies).toBeGreaterThan(overLimit.limit);
    expect(overLimit.boards).toEqual(["main", "side"]);
  });

  it("reports deck size and singleton failures as shape issues, not card issues", () => {
    const shapeIssues = [
      {
        kind: "deck",
        code: "maindeck_too_small",
        count: 58,
        minimum: 60,
        message: "Maindeck has 58 cards; 60 required.",
      },
      {
        kind: "deck",
        code: "sideboard_too_large",
        count: 16,
        maximum: 15,
        message: "Sideboard has 16 cards; 15 allowed.",
      },
      {
        kind: "deck",
        code: "singleton_violated",
        cardNames: ["Llanowar Elves"],
        message: "Llanowar Elves appears more than once in a singleton format.",
      },
    ] satisfies DeckIssue[];

    expectTypeOf(shapeIssues).toExtend<readonly DeckIssue[]>();
    expect(shapeIssues).toHaveLength(3);
  });

  it("distinguishes illegal-card issues from illegal-deck-shape issues", () => {
    expectTypeOf<CardIssue>().toExtend<Issue>();
    expectTypeOf<DeckIssue>().toExtend<Issue>();
    expectTypeOf<CardIssue>().not.toExtend<DeckIssue>();
    expectTypeOf<DeckIssue>().not.toExtend<CardIssue>();

    const label = (issue: Issue): string =>
      issue.kind === "card" ? `card:${issue.code}:${issue.cardName}` : `deck:${issue.code}`;

    const banned = {
      kind: "card",
      code: "banned",
      cardName: "Cori-Steel Cutter",
      oracleId: coriSteelCutter,
      boards: ["main"],
      message: "Cori-Steel Cutter is banned.",
    } satisfies CardIssue;
    const tooSmall = {
      kind: "deck",
      code: "maindeck_too_small",
      count: 58,
      minimum: 60,
      message: "Maindeck has 58 cards; 60 required.",
    } satisfies DeckIssue;

    expect(label(banned)).toBe("card:banned:Cori-Steel Cutter");
    expect(label(tooSmall)).toBe("deck:maindeck_too_small");
  });

  it("returns every issue, not the first, split by family", () => {
    const verdict = {
      legal: false,
      cardIssues: [
        {
          kind: "card",
          code: "banned",
          cardName: "Cori-Steel Cutter",
          oracleId: coriSteelCutter,
          boards: ["main"],
          message: "Cori-Steel Cutter is banned.",
        },
        {
          kind: "card",
          code: "not_in_pool",
          cardName: "Black Lotus",
          oracleId: blackLotus,
          boards: ["main"],
          message: "Black Lotus has no printing in a legal set.",
        },
      ],
      deckIssues: [
        {
          kind: "deck",
          code: "sideboard_too_large",
          count: 16,
          maximum: 15,
          message: "Sideboard has 16 cards; 15 allowed.",
        },
      ],
    } satisfies LegalityVerdict;

    expectTypeOf(verdict).toExtend<LegalityVerdict>();
    expect(verdict.cardIssues).toHaveLength(2);
    expect(verdict.deckIssues).toHaveLength(1);
  });

  it("is legal with no issues — basic lands never trip the copy limit", () => {
    // "9 Forest (EOE) 266" is a real Season II line; basics are exempt (Part IX answer 2).
    const verdict = {
      legal: true,
      cardIssues: [],
      deckIssues: [],
    } satisfies LegalityVerdict;

    expectTypeOf(verdict).toExtend<LegalityVerdict>();
    expect(verdict.legal).toBe(true);
    expect(seasonTwoRules.constraints.maxCopies).toBe(4);
  });

  it("exposes a closed set of machine-readable issue codes", () => {
    const messages = {
      unresolved_name: "Card name could not be resolved",
      not_in_pool: "No printing in a legal set",
      banned: "Banned",
      over_copy_limit: "Too many copies",
      maindeck_too_small: "Maindeck too small",
      maindeck_too_large: "Maindeck too large",
      sideboard_too_large: "Sideboard too large",
      singleton_violated: "Singleton violated",
    } satisfies Record<IssueCode, string>;

    expectTypeOf(messages).toExtend<Record<IssueCode, string>>();
    expect(Object.keys(messages)).toHaveLength(8);
  });

  describe("FormatVersionDetail", () => {
    it("is the un-flattened form resolve-format takes", () => {
      const detail: FormatVersionDetail = {
        version: {
          id: "22222222-2222-4222-8222-000000000001",
          name: "Planar Standard",
          effectiveFrom: "2026-01-21",
          effectiveTo: null,
          notesMarkdown: null,
          isCurrent: true,
        },
        legalSets: [setCode("FDN"), setCode("DFT")],
        cardRules: [],
        constraints: seasonTwoConstraints,
      };

      expectTypeOf(detail.legalSets).toEqualTypeOf<readonly SetCode[]>();
      // Null, not a default: `db` may not import core's DEFAULT_CONSTRAINTS, so a
      // version with no row of its own says so and the caller resolves it.
      expectTypeOf(detail.constraints).toEqualTypeOf<DeckConstraints | null>();
    });
  });
});
