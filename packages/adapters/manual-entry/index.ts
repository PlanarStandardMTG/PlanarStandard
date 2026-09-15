// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.3 — the always-available path: an organizer types the pairings in.

import type {
  IsoDate,
  ParseIssue,
  ParsedEvent,
  ParsedMatch,
  RawInput,
  RawRow,
  ResultsAdapter,
} from "@ps/contracts";

import { normalizeResult } from "../normalize-result/index";
import { rawText } from "../raw-input/index";

/**
 * The discriminator our own form writes into the payload. Requiring it is what
 * keeps this adapter from claiming the next JSON source somebody adds: manual
 * entry is the one input we generate ourselves, so it can label itself.
 */
const ADAPTER_TAG = "manual-entry";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const manualEntry: ResultsAdapter = {
  id: ADAPTER_TAG,
  // Matches only, by design (§9). Standings a human typed are standings
  // somebody derived from pairings they already had.
  capabilities: ["matches"],
  detect,
  parse,
};

function detect(input: RawInput): boolean {
  const payload = readPayload(input);
  return payload !== null && payload["adapter"] === ADAPTER_TAG;
}

function parse(input: RawInput): ParsedEvent {
  const payload = readPayload(input);
  if (payload === null) {
    return {
      capabilities: [],
      issues: [
        {
          code: "unreadable-payload",
          severity: "error",
          message: "The entry form's payload is not readable JSON.",
        },
      ],
    };
  }

  const issues: ParseIssue[] = [];
  const rows = Array.isArray(payload["matches"]) ? payload["matches"] : [];
  const matches: ParsedMatch[] = [];

  rows.forEach((row, rowIndex) => {
    const match = readMatch(row, rowIndex, issues);
    if (match !== null) matches.push(match);
  });

  if (matches.length === 0) {
    issues.push({
      code: "empty-file",
      severity: "error",
      message: "No pairings were entered.",
    });
  }

  return {
    ...present([
      ["name", asText(payload["name"])],
      ["platform", asText(payload["platform"])],
      ["externalUrl", asText(payload["externalUrl"])],
      ["structure", asText(payload["structure"])],
    ] as const),
    ...present([["date", asDate(payload["date"])]] as const),
    ...present([
      ["rounds", asInt(payload["rounds"])],
      ["playerCount", playerCount(matches)],
    ] as const),
    capabilities: matches.length > 0 ? ["matches"] : [],
    ...(matches.length > 0 ? { matches } : {}),
    issues,
  };
}

function readMatch(row: unknown, rowIndex: number, issues: ParseIssue[]): ParsedMatch | null {
  if (!isRecord(row)) {
    issues.push({
      code: "unreadable-row",
      severity: "error",
      message: "The pairing is not an object.",
      rowIndex,
    });
    return null;
  }

  const p1Handle = asText(row["p1"] ?? row["p1Handle"]);
  if (p1Handle === undefined) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "The pairing names no first player.",
      rowIndex,
    });
    return null;
  }

  const p2Handle = asText(row["p2"] ?? row["p2Handle"]);
  // No opponent is a bye, whatever the form's result field says.
  if (p2Handle === undefined) {
    return {
      rowIndex,
      raw: scalarsOf(row),
      p1Handle,
      result: "bye",
      ...present([
        ["round", asInt(row["round"])],
        ["tableNumber", asInt(row["table"] ?? row["tableNumber"])],
      ] as const),
    };
  }

  const normalized = normalizeResult({
    result: asText(row["result"]),
    p1Games: asInt(row["p1Games"]),
    p2Games: asInt(row["p2Games"]),
    gameDraws: asInt(row["gameDraws"]),
  });

  if (normalized.result === null) {
    issues.push({
      code: "unreadable-result",
      severity: "warning",
      message: `Could not read a result for ${p1Handle}; the pairing stages for review.`,
      rowIndex,
    });
  }

  return {
    rowIndex,
    raw: scalarsOf(row),
    p1Handle,
    p2Handle,
    result: normalized.result,
    ...present([
      ["round", asInt(row["round"])],
      ["tableNumber", asInt(row["table"] ?? row["tableNumber"])],
      ["p1Games", normalized.p1Games],
      ["p2Games", normalized.p2Games],
      ["gameDraws", normalized.gameDraws],
    ] as const),
    ...present([["isElimination", asBool(row["isElimination"])]] as const),
  };
}

/** `staged_matches.raw` is flat (§13), so a nested value is dropped, not stringified. */
function scalarsOf(row: Record<string, unknown>): RawRow {
  const raw: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      raw[key] = value as string | number | boolean | null;
    }
  }
  return raw;
}

/** Distinct handles across the pairings — a bye has one side, not two. */
function playerCount(matches: readonly ParsedMatch[]): number | undefined {
  if (matches.length === 0) return undefined;
  const handles = new Set<string>();
  for (const match of matches) {
    handles.add(match.p1Handle);
    if (match.p2Handle !== undefined) handles.add(match.p2Handle);
  }
  return handles.size;
}

function readPayload(input: RawInput): Record<string, unknown> | null {
  const text = rawText(input).trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function present<K extends string, V>(
  entries: readonly (readonly [K, V | undefined])[],
): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {};
  for (const [key, value] of entries) if (value !== undefined) out[key] = value;
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function asDate(value: unknown): IsoDate | undefined {
  const text = asText(value);
  return text !== undefined && ISO_DATE.test(text) ? (text as IsoDate) : undefined;
}

function asInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  const text = asText(value);
  if (text === undefined || !/^-?\d+$/.test(text)) return undefined;
  return Number(text);
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = asText(value)?.toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return undefined;
}
