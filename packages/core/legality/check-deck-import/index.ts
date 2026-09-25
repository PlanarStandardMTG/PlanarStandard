import type { CardIndex, DeckFormat, DeckVisibility, ResolvedDeck } from "@ps/contracts";

import { parseDecklist } from "../../decklist/parse-decklist/index";
import { resolveDeck } from "../resolve-deck/index";

/**
 * Whether a pasted decklist can be saved as a deck (E20.28, E20.30).
 *
 * Every line has to parse: a line the site could not read cannot be stored as
 * anything. A name that does not resolve is **not** a problem — it is reported
 * as an `UnknownCard` for the member to confirm, and saved without an oracle id
 * (E18.10), because Kitchen Table allows any card ever printed and the dataset
 * holds only the fetch scope. Legality is not checked here either.
 *
 * Problems are codes, not sentences, so the page decides the wording.
 */
export const DECK_NAME_MAX = 80;
export const DECKLIST_MAX = 20_000;
export const DECK_VISIBILITIES: readonly DeckVisibility[] = ["public", "unlisted", "private"];
export const DECK_FORMATS: readonly DeckFormat[] = ["planar_standard", "kitchen_table"];

export interface DeckImportInput {
  readonly name: string;
  readonly visibility: string;
  readonly format: string;
  readonly decklist: string;
}

/** A name the card index does not know, with its closest matches. */
export interface UnknownCard {
  readonly lineNumber: number;
  readonly name: string;
  readonly suggestions: readonly string[];
}

export interface DeckImport {
  readonly name: string;
  readonly visibility: DeckVisibility;
  readonly format: DeckFormat;
  readonly deck: ResolvedDeck;
  readonly unknownCards: readonly UnknownCard[];
}

export type DeckImportProblem =
  | { readonly field: "name"; readonly code: "empty" | "long" }
  | { readonly field: "visibility" | "format"; readonly code: "invalid" }
  | { readonly field: "decklist"; readonly code: "empty" | "long" }
  | {
      readonly field: "decklist";
      readonly code: "unparsed-line";
      readonly lineNumber: number;
      readonly line: string;
    };

export type DeckImportCheck =
  | { readonly ok: true; readonly value: DeckImport }
  | { readonly ok: false; readonly problems: readonly DeckImportProblem[] };

/** The decklist alone — what the editor checks as the member types. */
export interface DecklistReading {
  readonly deck: ResolvedDeck;
  readonly problems: readonly DeckImportProblem[];
  readonly unknownCards: readonly UnknownCard[];
}

export function readDecklist(decklist: string, index: CardIndex): DecklistReading {
  if (decklist.length > DECKLIST_MAX) {
    return {
      deck: { cards: [], issues: [], hasUnresolvedCards: false },
      problems: [{ field: "decklist", code: "long" }],
      unknownCards: [],
    };
  }

  const deck = resolveDeck(parseDecklist(decklist), index);
  const problems: DeckImportProblem[] =
    deck.cards.length === 0 && deck.issues.length === 0
      ? [{ field: "decklist", code: "empty" }]
      : deck.issues.map((issue) => ({
          field: "decklist",
          code: "unparsed-line",
          lineNumber: issue.lineNumber,
          line: issue.raw,
        }));

  const unknownCards = deck.cards
    .filter((card) => card.oracleId === null)
    .map((card) => ({
      lineNumber: card.lineNumber,
      name: card.name,
      suggestions: (card.candidates ?? []).map((candidate) => candidate.name),
    }));

  return { deck, problems, unknownCards };
}

export function checkDeckImport(input: DeckImportInput, index: CardIndex): DeckImportCheck {
  const problems: DeckImportProblem[] = [];
  const name = input.name.trim();

  if (name.length === 0) problems.push({ field: "name", code: "empty" });
  else if (name.length > DECK_NAME_MAX) problems.push({ field: "name", code: "long" });

  const visibility = DECK_VISIBILITIES.find((v) => v === input.visibility);
  if (visibility === undefined) problems.push({ field: "visibility", code: "invalid" });

  const format = DECK_FORMATS.find((f) => f === input.format);
  if (format === undefined) problems.push({ field: "format", code: "invalid" });

  const reading = readDecklist(input.decklist, index);
  problems.push(...reading.problems);

  if (problems.length > 0 || visibility === undefined || format === undefined) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    value: { name, visibility, format, deck: reading.deck, unknownCards: reading.unknownCards },
  };
}
