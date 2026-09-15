import type { DecklistFilenameMeta, WinLossDraw } from "@ps/contracts";

/**
 * `Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL` (E3.6).
 *
 * The separator is a FULLWIDTH vertical line (U+FF5C) because ASCII `|` is
 * illegal in a filename on Windows. Some files come back with every separator
 * rewritten to `_` by the operating system or by a download, so that form is
 * accepted too.
 */
const SEPARATORS = ["｜", "|", "_"] as const;

/** `3-1-0` or `6-2` — how a record is told apart from a name segment. */
const RECORD = /^(\d+)-(\d+)(?:-(\d+))?$/;

/** A trailing `(alias)`, with or without a space before it: both occur. */
const TRAILING_ALIAS = /^(.*?)\s*\(([^()]+)\)\s*$/;

const EXTENSION = /\.(txt|dec|dek|mwdeck|cod|md)$/i;

/**
 * Reads what a decklist filename encodes.
 *
 * Segments after the player are frequently missing, so every one of them is
 * optional. Records are identified by shape rather than by position: a
 * three-part segment is the match record, a two-part one the game record, which
 * is what lets `Player｜Deck｜3-0-0｜6-2` (no archetype) parse correctly.
 */
export function parseFilename(filename: string): DecklistFilenameMeta {
  const stem = filename.replace(EXTENSION, "");
  const separator = SEPARATORS.find((candidate) => stem.includes(candidate));
  const segments = (separator === undefined ? [stem] : stem.split(separator))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let matchRecord: WinLossDraw | undefined;
  let gameRecord: WinLossDraw | undefined;

  // Records live at the end. Pull them off by shape, right to left.
  while (segments.length > 0) {
    const last = segments[segments.length - 1] as string;
    const record = parseRecord(last);
    if (record === null) break;
    if (record.draws === undefined && gameRecord === undefined) gameRecord = record;
    else if (matchRecord === undefined) matchRecord = record;
    else break;
    segments.pop();
  }

  const [playerSegment = "", deckName, archetype] = segments;
  const aliasMatch = TRAILING_ALIAS.exec(playerSegment);
  const player = aliasMatch?.[1]?.trim() ?? playerSegment;
  const alias = aliasMatch?.[2]?.trim();

  return {
    player,
    ...(alias === undefined || alias.length === 0 ? {} : { alias }),
    ...(deckName === undefined ? {} : { deckName }),
    ...(archetype === undefined ? {} : { archetype }),
    ...(matchRecord === undefined ? {} : { matchRecord }),
    ...(gameRecord === undefined ? {} : { gameRecord }),
  };
}

function parseRecord(segment: string): WinLossDraw | null {
  const match = RECORD.exec(segment);
  if (match === null) return null;
  const draws = match[3];
  return {
    wins: Number(match[1]),
    losses: Number(match[2]),
    // Absent, not zero: a `GW-GL` pair has no draw component at all.
    ...(draws === undefined ? {} : { draws: Number(draws) }),
  };
}
