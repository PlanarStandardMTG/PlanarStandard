// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// Shared by every delimited-text adapter (E12.2, E12.4, E12.5).

/** Sniffed in this order, which is also how a tie is broken. */
const DELIMITERS = [",", "\t", ";", "|"] as const;

export type Delimiter = (typeof DELIMITERS)[number];

export interface CsvTable {
  readonly delimiter: Delimiter;
  /** Every row the file holds, header included, in source order. */
  readonly rows: readonly (readonly string[])[];
}

/**
 * Read delimited text. Fields come back exactly as written — trimming and
 * header interpretation belong to the adapter, which knows what the column is.
 */
export function parseCsv(text: string, delimiter?: Delimiter): CsvTable {
  const body = stripBom(text);
  const chosen = delimiter ?? sniff(body);
  return {
    delimiter: chosen,
    rows: dropTrailingBlanks(splitRows(body, chosen)),
  };
}

/**
 * The delimiter that yields the widest consistent table. Counting separators on
 * the first line instead would pick `,` for a TSV whose event name contains a
 * comma, which is most of them.
 */
function sniff(text: string): Delimiter {
  let best: Delimiter = ",";
  let bestShare = 0;
  let bestWidth = 0;

  for (const candidate of DELIMITERS) {
    const { width, share } = shape(dropTrailingBlanks(splitRows(text, candidate)));
    if (share > bestShare || (share === bestShare && width > bestWidth)) {
      best = candidate;
      bestShare = share;
      bestWidth = width;
    }
  }

  return best;
}

/**
 * The commonest row width, and the share of rows that have it. Consistency is
 * scored ahead of width on purpose: splitting `Weekly, Season II, week 4` on
 * commas yields wider rows than the tabs that actually delimit the file, but
 * only some of them.
 */
function shape(rows: readonly (readonly string[])[]): {
  width: number;
  share: number;
} {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.length, (counts.get(row.length) ?? 0) + 1);

  let width = 0;
  let seen = 0;
  for (const [candidate, count] of counts) {
    if (candidate > 1 && (count > seen || (count === seen && candidate > width))) {
      width = candidate;
      seen = count;
    }
  }

  return width === 0 ? { width: 0, share: 0 } : { width, share: seen / rows.length };
}

function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;

    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    // A quote that opens a field quotes it; one in the middle of a field is a
    // literal inch mark, which is how `5" tall` survives a spreadsheet export.
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

function dropTrailingBlanks(rows: readonly string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && !(rows[end - 1] as string[]).some((field) => field.trim() !== "")) end -= 1;
  return rows.slice(0, end);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
