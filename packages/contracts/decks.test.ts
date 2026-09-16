import { describe, expectTypeOf, it } from "vitest";
import type { OracleId } from "./cards";
import type {
  Board,
  DeckParseIssue,
  DecklistFilenameMeta,
  ParsedDeck,
  ParsedLine,
  ResolutionCandidate,
  ResolvedCard,
  ResolvedDeck,
  WinLossDraw,
} from "./decks";

const feedTheSwarm = "3f0a1c7e-9b52-4a36-8d10-6c2b5e4f9a83" as OracleId;
const llanowarElves = "b8c4b1de-4d2c-4a1f-9e44-1f3a0c6b7d21" as OracleId;

describe("decks contracts", () => {
  it("represents a line with no set code and no collector number", () => {
    // `3 Llanowar Elves` — the bare form. Both fields absent, not empty strings.
    const bare = {
      qty: 3,
      name: "Llanowar Elves",
      foil: false,
      board: "main",
      lineNumber: 7,
    } satisfies ParsedLine;
    expectTypeOf(bare).toExtend<ParsedLine>();
    expectTypeOf<ParsedLine["set"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ParsedLine["collector"]>().toEqualTypeOf<string | undefined>();
  });

  it("keeps alphanumeric collector numbers and the foil marker", () => {
    // `2 Feed the Swarm (FDN) 712 *F*`
    const foiled = {
      qty: 2,
      name: "Feed the Swarm",
      set: "FDN",
      collector: "712",
      foil: true,
      board: "main",
      lineNumber: 12,
    } satisfies ParsedLine;
    // `4 ... (PLST) WOE-273` — printings come from outside the legal pool, and
    // collector numbers are strings, never numbers.
    const promo = {
      ...foiled,
      set: "PLST",
      collector: "WOE-273",
    } satisfies ParsedLine;
    expectTypeOf(foiled).toExtend<ParsedLine>();
    expectTypeOf<ParsedLine["foil"]>().toEqualTypeOf<boolean>();
    expectTypeOf(promo.collector).toEqualTypeOf<string>();
    expectTypeOf<ParsedLine["collector"]>().not.toExtend<number>();
  });

  it("carries split-card names verbatim and tags the board a line fell on", () => {
    // `4 Bloomvine Regent / Claim Territory (TDM) 136`, then a `SIDEBOARD:` header.
    const main = {
      qty: 4,
      name: "Bloomvine Regent / Claim Territory",
      set: "TDM",
      collector: "136",
      foil: false,
      board: "main",
      lineNumber: 1,
    } satisfies ParsedLine;
    const side = {
      qty: 4,
      name: "Depressurize",
      set: "EOE",
      collector: "95",
      foil: false,
      board: "side",
      lineNumber: 16,
    } satisfies ParsedLine;
    const deck = { lines: [main, side], issues: [] } satisfies ParsedDeck;
    expectTypeOf(deck).toExtend<ParsedDeck>();
    expectTypeOf<ParsedLine["board"]>().toEqualTypeOf<Board>();
    expectTypeOf<Board>().toEqualTypeOf<"main" | "side" | "command">();
    expectTypeOf<ParsedDeck["lines"]>().toEqualTypeOf<readonly ParsedLine[]>();
  });

  it("retains an unparseable line as a typed issue naming the offending column", () => {
    const localized = {
      code: "invalid-quantity",
      raw: "4x4 Duress (STA) 29",
      lineNumber: 4,
      column: 2,
      message: "expected a quantity",
    } satisfies DeckParseIssue;
    // Column is optional — not every failure localizes to one token.
    const unlocalized = {
      code: "unrecognized-line",
      raw: "-- deck notes --",
      lineNumber: 21,
      message: "no quantity and no card name",
    } satisfies DeckParseIssue;
    const deck = {
      lines: [],
      issues: [localized, unlocalized],
    } satisfies ParsedDeck;
    expectTypeOf(deck).toExtend<ParsedDeck>();
    expectTypeOf<ParsedDeck["issues"]>().toEqualTypeOf<readonly DeckParseIssue[]>();
    expectTypeOf<DeckParseIssue["column"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<DeckParseIssue["raw"]>().toEqualTypeOf<string>();
  });

  it("resolves a card to an oracle id while keeping the printed set as provenance", () => {
    // `3 Llanowar Elves (M19) 314` resolves on the name; M19 survives into
    // `deck_cards.set_code` and never has to be a legal set (ADR 007, §14.1).
    const resolved = {
      qty: 3,
      name: "Llanowar Elves",
      oracleId: llanowarElves,
      set: "M19",
      collector: "314",
      foil: false,
      board: "main",
      lineNumber: 7,
    } satisfies ResolvedCard;
    expectTypeOf(resolved).toExtend<ResolvedCard>();
    expectTypeOf<ResolvedCard["oracleId"]>().toEqualTypeOf<OracleId | null>();
    expectTypeOf<ResolvedCard["set"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ResolvedCard["collector"]>().toEqualTypeOf<string | undefined>();
  });

  it("keeps an unresolved row, flags the deck, and offers ranked candidates", () => {
    const miss = {
      qty: 2,
      name: "Feed the Swarrm",
      oracleId: null,
      foil: false,
      board: "main",
      lineNumber: 12,
      candidates: [{ oracleId: feedTheSwarm, name: "Feed the Swarm", score: 0.93 }],
    } satisfies ResolvedCard;
    const flagged = {
      cards: [miss],
      issues: [],
      hasUnresolvedCards: true,
    } satisfies ResolvedDeck;
    expectTypeOf(flagged).toExtend<ResolvedDeck>();
    expectTypeOf<ResolvedDeck["hasUnresolvedCards"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ResolvedDeck["cards"]>().toEqualTypeOf<readonly ResolvedCard[]>();
    // Candidates are absent on an exact hit, so the field is optional.
    expectTypeOf<ResolvedCard["candidates"]>().toEqualTypeOf<
      readonly ResolutionCandidate[] | undefined
    >();
    expectTypeOf<ResolutionCandidate["score"]>().toEqualTypeOf<number>();
  });

  it("surfaces the parenthetical alias as its own field", () => {
    // `Zaunus13 (LikoRS)｜Dimir Midrange｜Abzan Midrange｜3-1-0｜7-3`
    const meta = {
      player: "Zaunus13",
      alias: "LikoRS",
      deckName: "Dimir Midrange",
      archetype: "Abzan Midrange",
      matchRecord: { wins: 3, losses: 1, draws: 0 },
      gameRecord: { wins: 7, losses: 3 },
    } satisfies DecklistFilenameMeta;
    expectTypeOf(meta).toExtend<DecklistFilenameMeta>();
    expectTypeOf<DecklistFilenameMeta["player"]>().toEqualTypeOf<string>();
    expectTypeOf<DecklistFilenameMeta["alias"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DecklistFilenameMeta["matchRecord"]>().toEqualTypeOf<WinLossDraw | undefined>();
  });

  it("tolerates a missing trailing segment and a handle with no alias", () => {
    // `serlupidus｜4c Dragons` — everything past the deck name absent.
    const truncated = {
      player: "serlupidus",
      deckName: "4c Dragons",
    } satisfies DecklistFilenameMeta;
    expectTypeOf(truncated).toExtend<DecklistFilenameMeta>();
    // `GW-GL` is a pair, so draws may simply be absent.
    const gameRecord = { wins: 7, losses: 3 } satisfies WinLossDraw;
    expectTypeOf(gameRecord).toExtend<WinLossDraw>();
    expectTypeOf<WinLossDraw["draws"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<WinLossDraw["wins"]>().toEqualTypeOf<number>();
  });
});
