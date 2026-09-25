import type { CardIndex, DeckVisibility, ResolvedDeck } from "@ps/contracts";

import { parseDecklist } from "../../decklist/parse-decklist/index";
import { resolveDeck } from "../resolve-deck/index";

/**
 * Whether a pasted decklist can be saved as a deck (E20.28).
 *
 * Every line has to parse and every name has to resolve: a deck saved with a
 * line the member never saw fail is a deck they did not mean to save. Legality
 * is **not** checked here — a brew that breaks the format is still a deck, and
 * the deck page says what is wrong with it.
 *
 * Problems are codes, not sentences, so the page decides the wording.
 */
export const DECK_NAME_MAX = 80;
export const DECKLIST_MAX = 20_000;
export const DECK_VISIBILITIES: readonly DeckVisibility[] = ["public", "unlisted", "private"];

export interface DeckImportInput {
  readonly name: string;
  readonly visibility: string;
  readonly decklist: string;
}

export interface DeckImport {
  readonly name: string;
  readonly visibility: DeckVisibility;
  readonly deck: ResolvedDeck;
}

export type DeckImportProblem =
  | { readonly field: "name"; readonly code: "empty" | "long" }
  | { readonly field: "visibility"; readonly code: "invalid" }
  | { readonly field: "decklist"; readonly code: "empty" | "long" }
  | {
      readonly field: "decklist";
      readonly code: "unparsed-line";
      readonly lineNumber: number;
      readonly line: string;
    }
  | {
      readonly field: "decklist";
      readonly code: "unknown-card";
      readonly lineNumber: number;
      readonly name: string;
      readonly suggestions: readonly string[];
    };

export type DeckImportCheck =
  | { readonly ok: true; readonly value: DeckImport }
  | { readonly ok: false; readonly problems: readonly DeckImportProblem[] };

export function checkDeckImport(input: DeckImportInput, index: CardIndex): DeckImportCheck {
  const problems: DeckImportProblem[] = [];
  const name = input.name.trim();

  if (name.length === 0) problems.push({ field: "name", code: "empty" });
  else if (name.length > DECK_NAME_MAX) problems.push({ field: "name", code: "long" });

  const visibility = DECK_VISIBILITIES.find((v) => v === input.visibility);
  if (visibility === undefined) problems.push({ field: "visibility", code: "invalid" });

  if (input.decklist.length > DECKLIST_MAX) {
    problems.push({ field: "decklist", code: "long" });
    return { ok: false, problems };
  }

  const deck = resolveDeck(parseDecklist(input.decklist), index);
  if (deck.cards.length === 0 && deck.issues.length === 0) {
    problems.push({ field: "decklist", code: "empty" });
  }
  const lines: DeckImportProblem[] = [
    ...deck.issues.map((issue) => ({
      field: "decklist" as const,
      code: "unparsed-line" as const,
      lineNumber: issue.lineNumber,
      line: issue.raw,
    })),
    ...deck.cards
      .filter((card) => card.oracleId === null)
      .map((card) => ({
        field: "decklist" as const,
        code: "unknown-card" as const,
        lineNumber: card.lineNumber,
        name: card.name,
        suggestions: (card.candidates ?? []).map((candidate) => candidate.name),
      })),
  ];
  // In the order the member reads the list, top to bottom.
  problems.push(...lines.sort((a, b) => lineOf(a) - lineOf(b)));

  if (problems.length > 0 || visibility === undefined) return { ok: false, problems };
  return { ok: true, value: { name, visibility, deck } };
}

const lineOf = (problem: DeckImportProblem): number =>
  "lineNumber" in problem ? problem.lineNumber : 0;
