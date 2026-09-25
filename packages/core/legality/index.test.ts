import { readFileSync } from "node:fs";

import type {
  CardDataset,
  FormatCardRule,
  FormatVersionId,
  OracleId,
  ResolvedDeck,
  SetCode,
} from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { parseDecklist } from "../decklist/parse-decklist/index";
import { buildCardIndex, normalizeSetCode } from "./build-card-index/index";
import { checkCard, copyLimit, isInPool } from "./check-card/index";
import { checkDeck } from "./check-deck/index";
import { DECK_NAME_MAX, DECKLIST_MAX, checkDeckImport } from "./check-deck-import/index";
import { MAX_CANDIDATES, resolveCardName } from "./resolve-card-name/index";
import { resolveDeck } from "./resolve-deck/index";
import { DEFAULT_CONSTRAINTS, resolveFormat } from "./resolve-format/index";

const fixture = (path: string): string =>
  readFileSync(new URL(`../../../fixtures/${path}`, import.meta.url), "utf8");

const DATASET = JSON.parse(fixture("cards/azorius-control-dataset.json")) as CardDataset;
const INDEX = buildCardIndex(DATASET);

/** Season II: the six sets from data/sets.json. */
const SEASON_II_SETS: readonly SetCode[] = ["sos", "ecl", "eoe", "tdm", "dft", "fdn"];

const format = (cardRules: readonly FormatCardRule[] = []) =>
  resolveFormat({
    formatVersionId: "season-ii" as FormatVersionId,
    legalSets: SEASON_II_SETS,
    cardRules,
  });

const oracleOf = (name: string): OracleId =>
  DATASET.oracle.find((c) => c.name === name)?.oracleId as OracleId;

const resolvedDeck = (document: string): ResolvedDeck =>
  resolveDeck(parseDecklist(document), INDEX);

describe("core/legality/build-card-index", () => {
  it("indexes every card by oracle id, with its printings", () => {
    expect(INDEX.byOracleId.size).toBe(DATASET.oracle.length);
    const entry = INDEX.byOracleId.get(oracleOf("Mistrise Village"));
    expect(entry?.printings).toHaveLength(1);
    expect(entry?.printings[0]?.setCode).toBe("ptdm");
  });

  it("keys names by their normalized form", () => {
    expect(INDEX.byNormalizedName.get("stock up")).toEqual([oracleOf("Stock Up")]);
    expect(INDEX.byNormalizedName.get("rides end")).toEqual([oracleOf("Ride's End")]);
  });

  it("keys each face of a split card as well as the whole name", () => {
    const whole = oracleOf("Marang River Regent / Coil and Catch");
    expect(INDEX.byNormalizedName.get("marang river regent // coil and catch")).toEqual([whole]);
    expect(INDEX.byNormalizedName.get("marang river regent")).toEqual([whole]);
    expect(INDEX.byNormalizedName.get("coil and catch")).toEqual([whole]);
  });

  it("indexes by legal set, lower-cased", () => {
    expect(INDEX.bySet.get("tdm")).toContain(oracleOf("Mistrise Village"));
    expect(normalizeSetCode("TDM")).toBe("tdm");
    // The promo set the card was printed in is not a legal-set key.
    expect(INDEX.bySet.has("ptdm")).toBe(false);
  });

  it("does not do file I/O — the dataset arrives as an argument", () => {
    const source = readFileSync(new URL("./build-card-index/index.ts", import.meta.url), "utf8");
    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("readFile");
  });
});

describe("core/legality/resolve-card-name", () => {
  it("resolves an exact name", () => {
    const result = resolveCardName("Stock Up", INDEX);
    expect(result).toMatchObject({ ok: true, oracleId: oracleOf("Stock Up") });
  });

  it("resolves through normalization — case, punctuation and the face separator", () => {
    expect(resolveCardName("stock up", INDEX).ok).toBe(true);
    expect(resolveCardName("Ride’s End", INDEX).ok).toBe(true);
    expect(resolveCardName("Marang River Regent // Coil and Catch", INDEX).ok).toBe(true);
    expect(resolveCardName("Marang River Regent", INDEX).ok).toBe(true);
  });

  it("returns a miss with candidates rather than a wrong guess", () => {
    const result = resolveCardName("Stok Up", INDEX);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.candidates[0]?.name).toBe("Stock Up");
    expect(result.candidates[0]?.score).toBeLessThan(1);
  });

  it("lets an exact match win over any fuzzy one", () => {
    // "Negate" is exact; "Annul" and others score, but must not displace it.
    const result = resolveCardName("Negate", INDEX);
    expect(result).toMatchObject({ ok: true, oracleId: oracleOf("Negate") });
  });

  it("caps and ranks the candidates", () => {
    const result = resolveCardName("e", INDEX, { minScore: 0 });
    if (result.ok) throw new Error("unreachable");
    expect(result.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    for (let i = 1; i < result.candidates.length; i += 1) {
      expect(result.candidates[i - 1]?.score).toBeGreaterThanOrEqual(
        result.candidates[i]?.score ?? 1,
      );
    }
  });

  it("offers nothing for a name with nothing in common", () => {
    const result = resolveCardName("Zzzzqqqq Xyzzy", INDEX);
    expect(result).toEqual({ ok: false, candidates: [] });
  });
});

describe("core/legality/resolve-format", () => {
  it("collapses the four tables into one lookup object", () => {
    const rules = format([
      { oracleId: oracleOf("Stock Up"), ruling: "banned", reason: "too good", effectiveFrom: null },
    ]);
    expect(rules.legalSets.has("fdn")).toBe(true);
    expect(rules.cardRules.get(oracleOf("Stock Up"))?.ruling).toBe("banned");
    expect(rules.constraints).toEqual(DEFAULT_CONSTRAINTS);
  });

  it("lower-cases the legal set codes so lookups are consistent", () => {
    const rules = resolveFormat({
      formatVersionId: "x" as FormatVersionId,
      legalSets: ["FDN", "TDM"],
      cardRules: [],
    });
    expect(rules.legalSets.has("fdn")).toBe(true);
    expect(rules.legalSets.has("FDN")).toBe(false);
  });

  it("defaults to 60 / 15 / 4, the answer to open question 2", () => {
    expect(DEFAULT_CONSTRAINTS.minMaindeck).toBe(60);
    expect(DEFAULT_CONSTRAINTS.maxSideboard).toBe(15);
    expect(DEFAULT_CONSTRAINTS.maxCopies).toBe(4);
    expect(DEFAULT_CONSTRAINTS.singleton).toBe(false);
  });
});

describe("core/legality/check-card", () => {
  const rules = format();

  it("is legal when the oracle card has a printing in a legal set (ADR 007)", () => {
    expect(
      checkCard(
        { cardName: "Stock Up", oracleId: oracleOf("Stock Up"), boards: ["main"] },
        rules,
        INDEX,
      ),
    ).toBeNull();
  });

  it("is legal through the pool even when the printing is a promo outside it", () => {
    // The deck plays Mistrise Village (PTDM) 261p. PTDM is not a legal set; TDM is.
    const card = INDEX.byOracleId.get(oracleOf("Mistrise Village"));
    expect(card?.printings[0]?.setCode).toBe("ptdm");
    expect(rules.legalSets.has("ptdm")).toBe(false);
    expect(isInPool(oracleOf("Mistrise Village"), rules, INDEX)).toBe(true);
    expect(
      checkCard(
        { cardName: "Mistrise Village", oracleId: oracleOf("Mistrise Village"), boards: ["main"] },
        rules,
        INDEX,
      ),
    ).toBeNull();
  });

  it("is illegal when no printing is in the pool", () => {
    const narrowed = resolveFormat({
      formatVersionId: "narrow" as FormatVersionId,
      legalSets: ["eoe"],
      cardRules: [],
    });
    expect(
      checkCard(
        { cardName: "Stock Up", oracleId: oracleOf("Stock Up"), boards: ["main"] },
        narrowed,
        INDEX,
      ),
    ).toMatchObject({ kind: "card", code: "not_in_pool" });
  });

  it("lets a legal_exception override absence from the pool", () => {
    const narrowed = resolveFormat({
      formatVersionId: "narrow" as FormatVersionId,
      legalSets: ["eoe"],
      cardRules: [
        {
          oracleId: oracleOf("Stock Up"),
          ruling: "legal_exception",
          reason: null,
          effectiveFrom: null,
        },
      ],
    });
    expect(
      checkCard(
        { cardName: "Stock Up", oracleId: oracleOf("Stock Up"), boards: ["main"] },
        narrowed,
        INDEX,
      ),
    ).toBeNull();
  });

  it("lets a ban override everything, including an exception", () => {
    const banned = format([
      {
        oracleId: oracleOf("Stock Up"),
        ruling: "banned",
        reason: "draws too many",
        effectiveFrom: null,
      },
    ]);
    expect(
      checkCard(
        { cardName: "Stock Up", oracleId: oracleOf("Stock Up"), boards: ["main"] },
        banned,
        INDEX,
      ),
    ).toMatchObject({ kind: "card", code: "banned" });
  });

  it("reports an unresolved name as a card issue rather than assuming legality", () => {
    expect(
      checkCard({ cardName: "Stokk Up", oracleId: null, boards: ["main"] }, rules, INDEX),
    ).toMatchObject({ kind: "card", code: "unresolved_name", oracleId: null });
  });

  it("uses the restricted limit when a card carries one", () => {
    const restricted = format([
      {
        oracleId: oracleOf("Stock Up"),
        ruling: "restricted",
        limit: 1,
        reason: null,
        effectiveFrom: null,
      },
    ]);
    expect(copyLimit(oracleOf("Stock Up"), restricted)).toBe(1);
    expect(copyLimit(oracleOf("Negate"), restricted)).toBe(4);
  });
});

describe("core/legality/check-deck", () => {
  const rules = format();

  it("passes a real Season II deck (E5.6)", () => {
    const deck = resolvedDeck(fixture("decklists/real-deck-azorius-control.txt"));
    expect(deck.hasUnresolvedCards).toBe(false);

    const verdict = checkDeck(deck, rules, INDEX);
    expect(verdict.cardIssues).toEqual([]);
    expect(verdict.deckIssues).toEqual([]);
    expect(verdict.legal).toBe(true);
  });

  it("separates card issues from deck-shape issues", () => {
    const deck = resolvedDeck("4 Stock Up (DFT) 67\n5 Negate (FDN) 710\n");
    const verdict = checkDeck(deck, rules, INDEX);

    expect(verdict.legal).toBe(false);
    expect(verdict.cardIssues.every((i) => i.kind === "card")).toBe(true);
    expect(verdict.deckIssues.every((i) => i.kind === "deck")).toBe(true);
    expect(verdict.cardIssues.map((i) => i.code)).toContain("over_copy_limit");
    expect(verdict.deckIssues.map((i) => i.code)).toContain("maindeck_too_small");
  });

  it("returns every issue, not the first", () => {
    const deck = resolvedDeck("5 Stock Up (DFT) 67\n5 Negate (FDN) 710\n5 Annul (EOE) 46\n");
    const verdict = checkDeck(deck, rules, INDEX);
    expect(verdict.cardIssues.filter((i) => i.code === "over_copy_limit")).toHaveLength(3);
  });

  it("exempts basic lands from the copy limit", () => {
    const real = fixture("decklists/real-deck-azorius-control.txt");
    expect(real).toContain("7 Island");
    expect(real).toContain("7 Plains");
    const verdict = checkDeck(resolvedDeck(real), rules, INDEX);
    expect(verdict.cardIssues.filter((i) => i.code === "over_copy_limit")).toEqual([]);
  });

  it("counts copies across maindeck and sideboard together", () => {
    const deck = resolvedDeck("3 Negate (FDN) 710\nSIDEBOARD:\n2 Negate (FDN) 710\n");
    const issue = checkDeck(deck, rules, INDEX).cardIssues.find(
      (i) => i.code === "over_copy_limit",
    );
    expect(issue).toMatchObject({ copies: 5, limit: 4 });
    expect(issue?.boards.sort()).toEqual(["main", "side"]);
  });

  it("catches an oversized sideboard", () => {
    const sideboard = ["SIDEBOARD:", ...Array.from({ length: 4 }, () => "4 Annul (EOE) 46")];
    // 16 sideboard cards, which is also over the copy limit — both are reported.
    const deck = resolvedDeck(sideboard.join("\n"));
    const verdict = checkDeck(deck, rules, INDEX);
    expect(verdict.deckIssues.map((i) => i.code)).toContain("sideboard_too_large");
  });

  it("enforces singleton when the format asks for it, basics still exempt", () => {
    const highlander = resolveFormat({
      formatVersionId: "singleton" as FormatVersionId,
      legalSets: SEASON_II_SETS,
      cardRules: [],
      constraints: { ...DEFAULT_CONSTRAINTS, singleton: true, maxCopies: 1 },
    });
    const deck = resolvedDeck("2 Stock Up (DFT) 67\n7 Island (EOE) 270\n");
    const verdict = checkDeck(deck, highlander, INDEX);
    const issue = verdict.deckIssues.find((i) => i.code === "singleton_violated");
    expect(issue).toMatchObject({ cardNames: ["Stock Up"] });
  });

  it("flags an unresolved card rather than passing the deck", () => {
    const deck = resolvedDeck("4 Stokk Up (DFT) 67\n");
    expect(deck.hasUnresolvedCards).toBe(true);
    expect(checkDeck(deck, rules, INDEX).cardIssues.map((i) => i.code)).toContain(
      "unresolved_name",
    );
  });

  it("calls an empty deck illegal rather than vacuously legal", () => {
    const verdict = checkDeck({ cards: [], issues: [], hasUnresolvedCards: false }, rules, INDEX);
    expect(verdict.legal).toBe(false);
    expect(verdict.deckIssues.map((i) => i.code)).toContain("maindeck_too_small");
  });
});

describe("core/legality/resolve-deck", () => {
  it("resolves every line and keeps its provenance", () => {
    const deck = resolveDeck(parseDecklist("4 Stock Up (DFT) 67\nSIDEBOARD:\n2 Negate\n"), INDEX);

    expect(deck.hasUnresolvedCards).toBe(false);
    expect(deck.cards[0]).toMatchObject({
      qty: 4,
      name: "Stock Up",
      oracleId: oracleOf("Stock Up"),
      set: "DFT",
      collector: "67",
      board: "main",
    });
    expect(deck.cards[1]).toMatchObject({ name: "Negate", board: "side" });
    expect(deck.cards[1]).not.toHaveProperty("set");
  });

  it("keeps a miss with its candidates instead of guessing", () => {
    const deck = resolveDeck(parseDecklist("4 Stokk Up\n"), INDEX);

    expect(deck.hasUnresolvedCards).toBe(true);
    expect(deck.cards[0]?.oracleId).toBeNull();
    expect(deck.cards[0]?.candidates?.[0]?.name).toBe("Stock Up");
  });
});

describe("core/legality/check-deck-import", () => {
  const input = { name: "  Azorius  ", visibility: "unlisted", decklist: "4 island\n4 plains\n" };

  it("accepts a plain list, trimming the name", () => {
    const check = checkDeckImport(input, INDEX);

    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.value.name).toBe("Azorius");
    expect(check.value.visibility).toBe("unlisted");
    expect(check.value.deck.cards.map((c) => c.oracleId)).toEqual([
      oracleOf("Island"),
      oracleOf("Plains"),
    ]);
  });

  it("does not check legality — an eight-card brew still saves", () => {
    expect(checkDeckImport(input, INDEX).ok).toBe(true);
  });

  it("names every line it could not read and every card it could not find, in line order", () => {
    const check = checkDeckImport(
      { ...input, decklist: "2 Stokk Up\nfour Plains\n4 Island\n" },
      INDEX,
    );

    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.problems).toEqual([
      expect.objectContaining({ code: "unknown-card", lineNumber: 1, name: "Stokk Up" }),
      expect.objectContaining({ code: "unparsed-line", lineNumber: 2, line: "four Plains" }),
    ]);
    const unknown = check.problems[0];
    expect(unknown && "suggestions" in unknown ? unknown.suggestions[0] : null).toBe("Stock Up");
  });

  it("refuses an empty list, a missing or long name, and an unknown visibility", () => {
    const codes = (overrides: Partial<typeof input>) => {
      const check = checkDeckImport({ ...input, ...overrides }, INDEX);
      return check.ok ? [] : check.problems.map((p) => `${p.field}:${p.code}`);
    };

    expect(codes({ decklist: "\n\n" })).toEqual(["decklist:empty"]);
    expect(codes({ name: " " })).toEqual(["name:empty"]);
    expect(codes({ name: "x".repeat(DECK_NAME_MAX + 1) })).toEqual(["name:long"]);
    expect(codes({ visibility: "secret" })).toEqual(["visibility:invalid"]);
    expect(codes({ decklist: "x".repeat(DECKLIST_MAX + 1) })).toEqual(["decklist:long"]);
  });
});
