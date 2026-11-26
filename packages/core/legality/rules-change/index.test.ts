import type {
  DeckConstraints,
  FormatCardRule,
  FormatVersionId,
  OracleId,
  SetCode,
} from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { DEFAULT_CONSTRAINTS, resolveFormat } from "../resolve-format/index";
import { rulesChange } from "./index";

const SHOCK = "oracle:shock" as OracleId;

const rules = ({
  sets = ["FDN", "DFT"],
  cards = [],
  constraints = {},
}: {
  sets?: readonly string[];
  cards?: readonly FormatCardRule[];
  constraints?: Partial<DeckConstraints>;
}) =>
  resolveFormat({
    formatVersionId: "version" as FormatVersionId,
    legalSets: sets as SetCode[],
    cardRules: cards,
    constraints: { ...DEFAULT_CONSTRAINTS, ...constraints },
  });

const base = { oracleId: SHOCK, reason: null, effectiveFrom: null };
const banned: FormatCardRule = { ...base, ruling: "banned" };
const restricted: FormatCardRule = { ...base, ruling: "restricted", limit: 1 };
const exception: FormatCardRule = { ...base, ruling: "legal_exception" };

describe("core/legality/rules-change", () => {
  it("is neither when nothing that decides legality changed", () => {
    expect(rulesChange(rules({}), rules({}))).toStrictEqual({ narrowed: false, widened: false });
  });

  it("narrows when a set leaves the pool and widens when one joins", () => {
    expect(rulesChange(rules({}), rules({ sets: ["FDN"] }))).toStrictEqual({
      narrowed: true,
      widened: false,
    });
    expect(rulesChange(rules({}), rules({ sets: ["FDN", "DFT", "TDM"] }))).toStrictEqual({
      narrowed: false,
      widened: true,
    });
  });

  it("is both for a rotation", () => {
    expect(rulesChange(rules({}), rules({ sets: ["FDN", "TDM"] }))).toStrictEqual({
      narrowed: true,
      widened: true,
    });
  });

  it("reads a ban, a restriction and a lost exception as narrowing", () => {
    for (const cards of [[banned], [restricted]]) {
      expect(rulesChange(rules({}), rules({ cards })).narrowed).toBe(true);
    }
    expect(rulesChange(rules({ cards: [exception] }), rules({})).narrowed).toBe(true);
  });

  it("reads an unban, a lifted restriction and a new exception as widening only", () => {
    expect(rulesChange(rules({ cards: [banned] }), rules({}))).toStrictEqual({
      narrowed: false,
      widened: true,
    });
    expect(rulesChange(rules({ cards: [restricted] }), rules({}))).toStrictEqual({
      narrowed: false,
      widened: true,
    });
    expect(rulesChange(rules({}), rules({ cards: [exception] }))).toStrictEqual({
      narrowed: false,
      widened: true,
    });
  });

  it("reads tighter deck limits as narrowing and looser ones as widening", () => {
    const tighter: readonly Partial<DeckConstraints>[] = [
      { minMaindeck: 61 },
      { maxMaindeck: 60 },
      { maxSideboard: 10 },
      { maxCopies: 3 },
      { singleton: true },
    ];
    for (const constraints of tighter) {
      expect(rulesChange(rules({}), rules({ constraints }))).toStrictEqual({
        narrowed: true,
        widened: false,
      });
      expect(rulesChange(rules({ constraints }), rules({}))).toStrictEqual({
        narrowed: false,
        widened: true,
      });
    }
  });

  it("ignores a set code's case", () => {
    expect(rulesChange(rules({}), rules({ sets: ["fdn", "dft"] }))).toStrictEqual({
      narrowed: false,
      widened: false,
    });
  });
});
