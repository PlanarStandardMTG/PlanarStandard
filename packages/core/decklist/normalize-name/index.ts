/**
 * Canonicalizes a card name so the many spellings decklists use all reach the
 * same key in the card index.
 *
 * Deliberately lossy — it exists to be a lookup key, never to be displayed. The
 * name as the player typed it stays on `ParsedLine.name`.
 */

/** Scryfall joins faces with ` // `; decklist exports write ` / `. Same card. */
const FACE_SEPARATOR = " // ";
const FACE_SPLIT = /\s*\/{1,2}\s*/;

/** Apostrophes, quotes, dashes and spaces arrive in several Unicode flavours. */
const LOOKALIKES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’‛ʼ＇]/g, "'"],
  [/[“”‟＂]/g, '"'],
  [/[‐-―−－]/g, "-"],
  [/[   　]/g, " "],
];

/** Anything that is not a letter, a digit, or a space carries no identity. */
const NOISE = /[^\p{L}\p{N} ]/gu;

/**
 * NFKC, case-folded, punctuation-stripped, faces joined by ` // `.
 *
 * Idempotent: normalizing an already-normalized name returns it unchanged.
 */
export function normalizeName(name: string): string {
  let text = name.normalize("NFKC");
  for (const [pattern, replacement] of LOOKALIKES) {
    text = text.replace(pattern, replacement);
  }
  return text
    .split(FACE_SPLIT)
    .map(scrub)
    .filter((face) => face.length > 0)
    .join(FACE_SEPARATOR);
}

/**
 * The faces of a multi-face card, in printed order, each normalized.
 *
 * `build-card-index` keys every face as well as the whole name, because a
 * decklist may write either the front face alone or both.
 */
export function normalizeFaces(name: string): readonly string[] {
  const normalized = normalizeName(name);
  return normalized.length === 0 ? [] : normalized.split(FACE_SEPARATOR);
}

function scrub(face: string): string {
  return face.toLowerCase().replace(NOISE, "").replace(/\s+/g, " ").trim();
}
