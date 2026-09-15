// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.7 — the community archetype map, read back into decklists. One-time backfill.

import type {
  IsoDate,
  ParseIssue,
  ParsedDecklistEntry,
  ParsedEvent,
  RawInput,
  ResultsAdapter,
} from "@ps/contracts";

import { rawExtension, rawMediaType, rawText } from "../raw-input/index";

/** `<b>serlupidus — 4c Dragons (Midrange)</b>`. The dash is em, not hyphen. */
const TITLE = /^<b>\s*(.+?)\s*[—–]\s*(.+?)\s*<\/b>$/;
const DATE = /^<i>\s*(\d{4}-\d{2}-\d{2})\s*<\/i>$/;
const RECORD = /^(Rounds|Games):\s*([\d-]+)/;
const DECK_LINE = /^\d+\s+\S/;

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export const archetypeMapHtml: ResultsAdapter = {
  id: "archetype-map-html",
  capabilities: ["decklists"],
  detect,
  parse,
};

function detect(input: RawInput): boolean {
  if (!["html", "htm"].includes(rawExtension(input)) && rawMediaType(input) !== "text/html") {
    return false;
  }
  const text = rawText(input);
  return text.includes("Plotly.newPlot") && TITLE.test(firstSegment(text));
}

/**
 * Every decklist the map is carrying, each dated on its own.
 *
 * The map is not an event: it is 35 of them in one file, which is why the date
 * and both records ride on the decklist rather than on the `ParsedEvent`.
 */
function parse(input: RawInput): ParsedEvent {
  const text = rawText(input);
  const issues: ParseIssue[] = [];
  const decklists: ParsedDecklistEntry[] = [];

  hoverTexts(text).forEach((hover, rowIndex) => {
    const entry = readEntry(hover, rowIndex, issues);
    if (entry !== null) decklists.push(entry);
  });

  if (decklists.length === 0) {
    issues.push({
      code: "empty-file",
      severity: "error",
      message: "No decklists were found in the map's hover text.",
    });
  }

  return {
    capabilities: decklists.length > 0 ? ["decklists"] : [],
    ...(decklists.length > 0 ? { decklists } : {}),
    issues,
  };
}

function readEntry(
  hover: string,
  rowIndex: number,
  issues: ParseIssue[],
): ParsedDecklistEntry | null {
  let handle: string | undefined;
  let archetypeRaw: string | undefined;
  let date: IsoDate | undefined;
  let matchRecord: string | undefined;
  let gameRecord: string | undefined;
  const lines: string[] = [];

  for (const segment of hover.split("<br>").map((s) => decode(s).trim())) {
    if (segment === "") continue;

    const title = TITLE.exec(segment);
    if (title !== null) {
      handle = title[1];
      archetypeRaw = title[2];
      continue;
    }

    const day = DATE.exec(segment);
    if (day !== null) {
      date = day[1] as IsoDate;
      continue;
    }

    const record = RECORD.exec(segment);
    if (record !== null) {
      if (record[1] === "Rounds") matchRecord = record[2];
      else gameRecord = record[2];
      continue;
    }

    // Anything left that opens with a count is a decklist line. A stray note
    // is dropped rather than staged as a card nobody can resolve.
    if (DECK_LINE.test(stripTags(segment))) lines.push(stripTags(segment));
  }

  if (handle === undefined) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "A hover entry has no player in its title; it was skipped.",
      rowIndex,
    });
    return null;
  }

  if (lines.length === 0) {
    issues.push({
      code: "empty-decklist",
      severity: "warning",
      message: `${handle} has a node on the map but no decklist behind it; it was skipped.`,
      rowIndex,
    });
    return null;
  }

  return {
    handle,
    ...(date === undefined ? {} : { date }),
    ...(matchRecord === undefined ? {} : { matchRecord }),
    ...(gameRecord === undefined ? {} : { gameRecord }),
    decklistText: lines.join("\n"),
    ...(archetypeRaw === undefined ? {} : { archetypeRaw }),
  };
}

/**
 * The hover strings, read out of Plotly's `"text": [...]` arrays.
 *
 * Scanned rather than regex-matched: a decklist line is free text inside a JSON
 * string, and `[` in a card name would end a lazy match early.
 */
function hoverTexts(document: string): readonly string[] {
  const texts: string[] = [];
  const marker = /"text"\s*:\s*\[/g;

  for (let match = marker.exec(document); match !== null; match = marker.exec(document)) {
    const end = closingBracket(document, marker.lastIndex - 1);
    if (end === -1) continue;
    const array: unknown = safeParse(document.slice(marker.lastIndex - 1, end + 1));
    if (!Array.isArray(array)) continue;
    for (const entry of array) if (typeof entry === "string") texts.push(entry);
    marker.lastIndex = end;
  }

  return texts;
}

/** The index of the `]` closing the `[` at `open`, skipping bracket characters inside strings. */
function closingBracket(document: string, open: number): number {
  let depth = 0;
  let inString = false;

  for (let i = open; i < document.length; i += 1) {
    const ch = document[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth += 1;
    else if (ch === "]" && --depth === 0) return i;
  }

  return -1;
}

function firstSegment(document: string): string {
  const [first] = hoverTexts(document);
  return first === undefined ? "" : decode(first.split("<br>")[0] ?? "").trim();
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function stripTags(segment: string): string {
  return segment.replace(/<[^>]*>/g, "").trim();
}

function decode(segment: string): string {
  return segment.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}
