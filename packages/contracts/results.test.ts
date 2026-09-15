import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AdapterDetection,
  Capability,
  ColumnMapping,
  ParsedDecklistEntry,
  ParsedEvent,
  ParsedMatch,
  ParsedRosterEntry,
  ParsedStanding,
  RawInput,
  ResultsAdapter,
} from "./results";

const pairingsCsv = [
  "Round,Table,Player 1,Player 2,Result",
  "3,4,serlupidus,Sunsett,2-1",
  "3,5,Zaunus13 (LikoRS),c0d33,2-0",
  "3,6,divnyi (Mika),,bye",
].join("\n");

// No @types/node in this package, so bytes are built without TextEncoder.
const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(Array.from(text, (character) => character.charCodeAt(0)));

const csvUpload = {
  fileName: "planar-standard-2026-08-01-pairings.csv",
  mediaType: "text/csv",
  bytes: bytesOf(pairingsCsv),
  text: pairingsCsv,
} satisfies RawInput;

const meleeCsv = {
  id: "melee-csv",
  capabilities: ["matches", "standings", "roster"],
  detect(input) {
    return (
      input.fileName.endsWith(".csv") && (input.text ?? "").startsWith("Round,")
    );
  },
  parse(input) {
    return {
      name: input.fileName,
      date: "2026-08-01",
      platform: "melee",
      rounds: 5,
      playerCount: 98,
      capabilities: ["matches"],
      matches: [
        {
          rowIndex: 0,
          raw: {
            Round: "3",
            Table: "4",
            "Player 1": "serlupidus",
            "Player 2": "Sunsett",
            Result: "2-1",
          },
          round: 3,
          tableNumber: 4,
          p1Handle: "serlupidus",
          p2Handle: "Sunsett",
          p1Games: 2,
          p2Games: 1,
          gameDraws: 0,
          result: "p1_win",
          isElimination: false,
        },
      ],
      issues: [],
    };
  },
} satisfies ResultsAdapter;

// legacy-xlsx (E12.6): the one-time backfill source, standings only.
const legacyXlsx = {
  id: "legacy-xlsx",
  capabilities: ["standings"],
  detect(input) {
    return input.fileName.endsWith(".xlsx");
  },
  parse(input) {
    return {
      name: input.fileName,
      date: "2026-08-01",
      capabilities: ["standings"],
      standings: [
        {
          handle: "serlupidus",
          placement: 1,
          matchWins: 5,
          matchLosses: 0,
          matchDraws: 0,
          gameWins: 10,
          gameLosses: 3,
          dropped: false,
        },
      ],
      issues: [],
    };
  },
} satisfies ResultsAdapter;

describe("results contracts", () => {
  it("hands an adapter the bytes and, for text sources, an existing decode", () => {
    const xlsxUpload = {
      fileName: "Planar Standard S2 2026-08-01.xlsx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    } satisfies RawInput;

    expectTypeOf(xlsxUpload).toExtend<RawInput>();
    expectTypeOf(csvUpload).toExtend<RawInput>();
    expectTypeOf<RawInput["bytes"]>().toEqualTypeOf<Uint8Array>();
    expect(csvUpload.text).toBe(pairingsCsv);
    expect(xlsxUpload.bytes.byteLength).toBe(4);
  });

  it("carries an operator-supplied column mapping for generic-csv", () => {
    const byHeader = {
      round: "Round",
      p1Handle: "Player 1",
      p2Handle: "Player 2",
      result: "Result",
    } satisfies ColumnMapping;

    // An export with no header row is addressed positionally.
    const byIndex = {
      handle: 0,
      placement: 1,
      matchWins: 2,
    } satisfies ColumnMapping;

    const mapped = { ...csvUpload, columnMapping: byHeader } satisfies RawInput;

    expectTypeOf(mapped).toExtend<RawInput>();
    expectTypeOf(byIndex).toExtend<ColumnMapping>();
    expect(mapped.columnMapping.p1Handle).toBe("Player 1");
  });

  it("is { id, detect(RawInput): boolean, parse(RawInput): ParsedEvent, capabilities }", () => {
    expectTypeOf(meleeCsv).toExtend<ResultsAdapter>();
    expectTypeOf<ResultsAdapter["detect"]>().toExtend<
      (input: RawInput) => boolean
    >();
    expectTypeOf<ResultsAdapter["parse"]>().toExtend<
      (input: RawInput) => ParsedEvent
    >();
    expectTypeOf<ResultsAdapter["capabilities"]>().toExtend<
      readonly Capability[]
    >();

    expect(meleeCsv.detect(csvUpload)).toBe(true);
    expect(meleeCsv.parse(csvUpload).capabilities).toEqual(["matches"]);
  });

  it("lets a standings-only adapter type-check without faking matches", () => {
    const event = legacyXlsx.parse({
      fileName: "Planar Standard S2 2026-08-01.xlsx",
      bytes: new Uint8Array([0x50, 0x4b]),
    });

    expectTypeOf(event).toExtend<ParsedEvent>();
    expectTypeOf<ParsedEvent["matches"]>().toEqualTypeOf<
      readonly ParsedMatch[] | undefined
    >();
    expect(legacyXlsx.capabilities).not.toContain("matches");
    // Not an empty array — that would read as "this event had no pairings" (ADR 006).
    expect("matches" in event).toBe(false);
  });

  it("records a bye with no opponent", () => {
    const bye = {
      rowIndex: 2,
      raw: {
        Round: "3",
        Table: "6",
        "Player 1": "divnyi (Mika)",
        "Player 2": "",
        Result: "bye",
      },
      round: 3,
      tableNumber: 6,
      p1Handle: "divnyi (Mika)",
      result: "bye",
    } satisfies ParsedMatch;

    expectTypeOf(bye).toExtend<ParsedMatch>();
    expect(bye).not.toHaveProperty("p2Handle");
  });

  it("stages a row whose result could not be normalized, with an issue instead of a throw", () => {
    const unreadable = {
      rowIndex: 7,
      raw: {
        Round: "4",
        "Player 1": "c0d33",
        "Player 2": "Sunsett",
        Result: "ID",
      },
      round: 4,
      p1Handle: "c0d33",
      p2Handle: "Sunsett",
      result: null,
    } satisfies ParsedMatch;

    const event = {
      capabilities: ["matches"],
      matches: [unreadable],
      issues: [
        {
          code: "unrecognized_result",
          severity: "warning",
          message:
            'Row 7: result "ID" is not a recognized outcome. Set it in review.',
          rowIndex: 7,
          column: "Result",
        },
      ],
    } satisfies ParsedEvent;

    expectTypeOf(event).toExtend<ParsedEvent>();
    expect(event.matches[0]?.result).toBeNull();
    expect(event.issues[0]?.rowIndex).toBe(7);
  });

  it("mirrors tournament_entries in a standing", () => {
    const standing = {
      handle: "Sunsett",
      placement: 4,
      matchWins: 3,
      matchLosses: 1,
      matchDraws: 1,
      gameWins: 7,
      gameLosses: 4,
      dropped: false,
    } satisfies ParsedStanding;

    expectTypeOf(standing).toExtend<ParsedStanding>();
    expect(standing.handle).toBe("Sunsett");
  });

  it("pairs a handle with the display name and decklist reference a roster carries", () => {
    const entry = {
      handle: "Zaunus13 (LikoRS)",
      displayName: "Zaunus13",
      deckName: "Dragons",
      archetypeRaw: "4c Dragons",
      decklistUrl: "https://melee.gg/Decklist/View/123456",
    } satisfies ParsedRosterEntry;

    expectTypeOf(entry).toExtend<ParsedRosterEntry>();
    expect(entry.archetypeRaw).toBe("4c Dragons");
  });

  it("carries handle, date, both records, and raw text for a scraped decklist", () => {
    const entry = {
      handle: "serlupidus",
      date: "2026-08-01",
      matchRecord: "4-1-0",
      gameRecord: "9-4",
      archetypeRaw: "Abzan Midrange",
      decklistText: [
        "4 Bloomvine Regent / Claim Territory (TDM) 136",
        "3 Llanowar Elves (FDN) 227",
        "9 Forest (EOE) 266",
        "SIDEBOARD:",
        "4 Depressurize (EOE) 95",
      ].join("\n"),
    } satisfies ParsedDecklistEntry;

    expectTypeOf(entry).toExtend<ParsedDecklistEntry>();
    expect(entry.decklistText).toContain("SIDEBOARD:");
  });

  it("reports ambiguous detection instead of resolving it by registration order", () => {
    const ambiguous: AdapterDetection = {
      outcome: "ambiguous",
      candidates: [meleeCsv, legacyXlsx],
      issue: {
        code: "ambiguous_format",
        severity: "error",
        message: "melee-csv and legacy-xlsx both claim this file. Choose one.",
      },
    };

    const unrecognized: AdapterDetection = {
      outcome: "unrecognized",
      issue: {
        code: "unrecognized_format",
        severity: "error",
        message:
          "No adapter recognized this file. Try generic-csv with a column mapping.",
      },
    };

    expectTypeOf<Capability>().toEqualTypeOf<
      "matches" | "standings" | "roster" | "decklists"
    >();
    expect(
      ambiguous.outcome === "ambiguous" &&
        ambiguous.candidates.map((a) => a.id),
    ).toEqual(["melee-csv", "legacy-xlsx"]);
    expect(
      unrecognized.outcome === "unrecognized" && unrecognized.issue.code,
    ).toBe("unrecognized_format");
  });
});
