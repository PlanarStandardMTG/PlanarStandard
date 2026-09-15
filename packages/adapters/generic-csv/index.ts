// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.2 — the permanent floor. Every other adapter is a convenience over this one.

import type {
  Capability,
  ColumnRef,
  MappableField,
  ParseIssue,
  ParsedEvent,
  ParsedMatch,
  ParsedStanding,
  RawInput,
  RawRow,
  ResultsAdapter,
} from "@ps/contracts";

import { normalizeResult } from "../normalize-result/index";
import { parseCsv } from "../parse-csv/index";
import { rawExtension, rawMediaType, rawText } from "../raw-input/index";

const CSV_EXTENSIONS = new Set(["csv", "tsv", "txt"]);
const CSV_MEDIA_TYPES = new Set(["text/csv", "text/tab-separated-values", "text/plain"]);

/** `-- bye --`, `BYE`, `(bye)` — every spelling means "no opponent". */
const BYE = /^[^a-z0-9]*bye[^a-z0-9]*$/i;

export const genericCsv: ResultsAdapter = {
  id: "generic-csv",
  capabilities: ["matches", "standings"],
  detect,
  parse,
};

/**
 * Delimited text of any shape. This is the floor, so it claims anything it
 * could plausibly read — the registry consults it only once no specific adapter
 * has claimed the input (E12.1).
 */
function detect(input: RawInput): boolean {
  const text = rawText(input).trim();
  // JSON is delimited text by this test's standards, and manual-entry's payload
  // has commas in it.
  if (text === "" || text.startsWith("{") || text.startsWith("[")) return false;
  if (!CSV_EXTENSIONS.has(rawExtension(input)) && !CSV_MEDIA_TYPES.has(rawMediaType(input))) {
    return false;
  }
  return parseCsv(text).rows.some((row) => row.length > 1);
}

function parse(input: RawInput): ParsedEvent {
  const mapping = input.columnMapping ?? {};
  const table = parseCsv(rawText(input));
  // The first row is a header only when the mapping names a column by name. An
  // all-numeric mapping means the operator was pointing at indices because the
  // file had no headers, and guessing either way shifts every row by one.
  const hasHeader = Object.values(mapping).some((ref) => typeof ref === "string");
  const firstRow = (table.rows[0] ?? []).map((cell) => cell.trim());
  const header = hasHeader ? firstRow : [];
  const body = table.rows.slice(hasHeader ? 1 : 0);

  const issues: ParseIssue[] = [];
  const wantsStandings = mapping.handle !== undefined;
  // Both sides or neither. A pairing file with no opponent column would read as
  // a round of byes, and a bye is the one result Elo skips (ADR 006).
  const wantsMatches = mapping.p1Handle !== undefined && mapping.p2Handle !== undefined;
  if (mapping.p1Handle !== undefined && mapping.p2Handle === undefined) {
    issues.push({
      code: "missing-column-mapping",
      severity: "error",
      message: "Pairings need a p2Handle column as well as p1Handle; leave a bye's cell empty.",
      column: "p2Handle",
    });
  }

  if (body.length === 0) {
    issues.push({
      code: "empty-file",
      severity: "error",
      message: "The file has no data rows.",
    });
  }
  if (!wantsMatches && !wantsStandings) {
    issues.push({
      code: "missing-column-mapping",
      severity: "error",
      message:
        firstRow.length > 0
          ? `Point a column at p1Handle (for pairings) or handle (for standings). Columns found: ${firstRow.join(", ")}.`
          : "Point a column at p1Handle (for pairings) or handle (for standings).",
    });
    return { capabilities: [], issues };
  }

  const cell = (row: readonly string[], field: MappableField): string | undefined => {
    const index = columnIndex(mapping[field], header);
    if (index === null) return undefined;
    const value = row[index]?.trim();
    return value === undefined || value === "" ? undefined : value;
  };

  const matches: ParsedMatch[] = [];
  const standings: ParsedStanding[] = [];

  body.forEach((row, rowIndex) => {
    const raw = rawRow(row, header);
    if (wantsMatches) {
      const match = readMatch(row, rowIndex, raw, cell, issues);
      if (match !== null) matches.push(match);
    }
    if (wantsStandings) {
      const standing = readStanding(row, rowIndex, cell, issues);
      if (standing !== null) standings.push(standing);
    }
  });

  const capabilities: Capability[] = [];
  if (matches.length > 0) capabilities.push("matches");
  if (standings.length > 0) capabilities.push("standings");

  return {
    capabilities,
    // Omitted rather than empty: an empty `matches` reads as "this event had no
    // pairings", which is how a standings-only import silently goes rated.
    ...(matches.length > 0 ? { matches } : {}),
    ...(standings.length > 0 ? { standings } : {}),
    issues,
  };
}

type CellReader = (row: readonly string[], field: MappableField) => string | undefined;

function readMatch(
  row: readonly string[],
  rowIndex: number,
  raw: RawRow,
  cell: CellReader,
  issues: ParseIssue[],
): ParsedMatch | null {
  const p1Handle = cell(row, "p1Handle");
  if (p1Handle === undefined) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "No player in the p1Handle column; the row was skipped.",
      rowIndex,
    });
    return null;
  }

  const p2Raw = cell(row, "p2Handle");
  // No opponent is a bye whatever the sheet put in its result column: the 2-0
  // an organizer records there is administrative, not games that were played.
  if (p2Raw === undefined || BYE.test(p2Raw)) {
    return {
      rowIndex,
      raw,
      p1Handle,
      result: "bye",
      ...present([
        ["round", asInt(cell(row, "round"))],
        ["tableNumber", asInt(cell(row, "tableNumber"))],
      ] as const),
    };
  }

  const normalized = normalizeResult({
    result: cell(row, "result"),
    p1Games: asInt(cell(row, "p1Games")),
    p2Games: asInt(cell(row, "p2Games")),
    gameDraws: asInt(cell(row, "gameDraws")),
  });

  if (normalized.result === null) {
    issues.push({
      code: "unreadable-result",
      severity: "warning",
      message: `Could not read a result from "${cell(row, "result") ?? ""}"; the row stages for review.`,
      rowIndex,
    });
  }

  return {
    rowIndex,
    raw,
    p1Handle,
    p2Handle: p2Raw,
    result: normalized.result,
    ...present([
      ["round", asInt(cell(row, "round"))],
      ["tableNumber", asInt(cell(row, "tableNumber"))],
      ["p1Games", normalized.p1Games],
      ["p2Games", normalized.p2Games],
      ["gameDraws", normalized.gameDraws],
    ] as const),
    ...present([["isElimination", asBool(cell(row, "isElimination"))]] as const),
  };
}

function readStanding(
  row: readonly string[],
  rowIndex: number,
  cell: CellReader,
  issues: ParseIssue[],
): ParsedStanding | null {
  const handle = cell(row, "handle");
  if (handle === undefined) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "No player in the handle column; the row was skipped.",
      rowIndex,
    });
    return null;
  }

  return {
    handle,
    ...present([
      ["placement", asInt(cell(row, "placement"))],
      ["matchWins", asInt(cell(row, "matchWins"))],
      ["matchLosses", asInt(cell(row, "matchLosses"))],
      ["matchDraws", asInt(cell(row, "matchDraws"))],
      ["gameWins", asInt(cell(row, "gameWins"))],
      ["gameLosses", asInt(cell(row, "gameLosses"))],
    ] as const),
    ...present([["dropped", asBool(cell(row, "dropped"))]] as const),
  };
}

/** The source row as it was read, kept in `staged_matches.raw` (§26). */
function rawRow(row: readonly string[], header: readonly string[]): RawRow {
  const raw: Record<string, string> = {};
  row.forEach((value, index) => {
    const key = header[index]?.trim();
    raw[key === undefined || key === "" ? `col${index}` : key] = value;
  });
  return raw;
}

function columnIndex(ref: ColumnRef | undefined, header: readonly string[]): number | null {
  if (typeof ref === "number") return Number.isInteger(ref) && ref >= 0 ? ref : null;
  if (typeof ref !== "string") return null;
  const wanted = normalizeHeader(ref);
  const index = header.findIndex((name) => normalizeHeader(name) === wanted);
  return index === -1 ? null : index;
}

/** `Player 1`, `player_1` and `PLAYER1` are the same column to an operator. */
function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Only the fields the source actually carried — `exactOptionalPropertyTypes`. */
function present<K extends string, V>(
  entries: readonly (readonly [K, V | undefined])[],
): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {};
  for (const [key, value] of entries) if (value !== undefined) out[key] = value;
  return out;
}

function asInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const digits = /^-?\d+/.exec(value.replace(/^[^\d-]+/, ""));
  if (digits === null) return undefined;
  const parsed = Number(digits[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.toLowerCase();
  if (["true", "yes", "y", "1", "dropped", "drop"].includes(normalized)) return true;
  if (["false", "no", "n", "0", ""].includes(normalized)) return false;
  return undefined;
}
