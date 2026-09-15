import type {
  Board,
  CardIndex,
  CardIssue,
  DeckIssue,
  FormatRules,
  LegalityVerdict,
  OracleId,
  ResolvedDeck,
} from "@ps/contracts";

import { isBasicLand } from "../../similarity/deck-vector/index";
import { checkCard, copyLimit } from "../check-card/index";

interface CardTally {
  readonly cardName: string;
  readonly oracleId: OracleId | null;
  copies: number;
  readonly boards: Set<Board>;
  readonly isBasic: boolean;
}

/**
 * A whole deck against a format.
 *
 * Returns **every** issue, never just the first: a submitter fixing one problem
 * at a time across four round trips is how decklist validation earns a
 * reputation for being hostile.
 *
 * Copy limits count maindeck and sideboard **together**, which is how Magic
 * works, and **basic lands are exempt** (Part IX, answer 2).
 */
export function checkDeck(
  deck: ResolvedDeck,
  rules: FormatRules,
  index: CardIndex,
): LegalityVerdict {
  const tallies = tally(deck);
  const cardIssues: CardIssue[] = [];
  const deckIssues: DeckIssue[] = [];

  for (const entry of tallies.values()) {
    const boards = [...entry.boards];

    const issue = checkCard(
      { cardName: entry.cardName, oracleId: entry.oracleId, boards },
      rules,
      index,
    );
    if (issue !== null) cardIssues.push(issue);

    if (entry.isBasic || entry.oracleId === null) continue;
    const limit = copyLimit(entry.oracleId, rules);
    if (entry.copies > limit) {
      cardIssues.push({
        kind: "card",
        code: "over_copy_limit",
        cardName: entry.cardName,
        oracleId: entry.oracleId,
        boards,
        copies: entry.copies,
        limit,
        message: `${entry.copies} copies of ${entry.cardName}; the limit is ${limit}`,
      });
    }
  }

  const maindeck = countBoard(deck, "main");
  const sideboard = countBoard(deck, "side");
  const { minMaindeck, maxMaindeck, maxSideboard, singleton } = rules.constraints;

  if (maindeck < minMaindeck) {
    deckIssues.push({
      kind: "deck",
      code: "maindeck_too_small",
      count: maindeck,
      minimum: minMaindeck,
      message: `the maindeck has ${maindeck} cards; the minimum is ${minMaindeck}`,
    });
  }
  if (maxMaindeck !== null && maindeck > maxMaindeck) {
    deckIssues.push({
      kind: "deck",
      code: "maindeck_too_large",
      count: maindeck,
      maximum: maxMaindeck,
      message: `the maindeck has ${maindeck} cards; the maximum is ${maxMaindeck}`,
    });
  }
  if (sideboard > maxSideboard) {
    deckIssues.push({
      kind: "deck",
      code: "sideboard_too_large",
      count: sideboard,
      maximum: maxSideboard,
      message: `the sideboard has ${sideboard} cards; the maximum is ${maxSideboard}`,
    });
  }
  if (singleton) {
    const offenders = [...tallies.values()]
      .filter((entry) => !entry.isBasic && entry.copies > 1)
      .map((entry) => entry.cardName)
      .sort();
    if (offenders.length > 0) {
      deckIssues.push({
        kind: "deck",
        code: "singleton_violated",
        cardNames: offenders,
        message: `${offenders.length} card(s) appear more than once in a singleton format`,
      });
    }
  }

  return { legal: cardIssues.length === 0 && deckIssues.length === 0, cardIssues, deckIssues };
}

/** Copies per card across every board — the limit is not per board. */
function tally(deck: ResolvedDeck): ReadonlyMap<string, CardTally> {
  const tallies = new Map<string, CardTally>();
  for (const card of deck.cards) {
    if (card.board === "command") continue;
    // Unresolved cards have no id to key on, so their printed name stands in.
    const key = card.oracleId ?? `name:${card.name.toLowerCase()}`;
    const existing = tallies.get(key);
    if (existing === undefined) {
      tallies.set(key, {
        cardName: card.name,
        oracleId: card.oracleId,
        copies: card.qty,
        boards: new Set([card.board]),
        isBasic: isBasicLand(card.name),
      });
    } else {
      existing.copies += card.qty;
      existing.boards.add(card.board);
    }
  }
  return tallies;
}

function countBoard(deck: ResolvedDeck, board: Board): number {
  return deck.cards.reduce((total, card) => (card.board === board ? total + card.qty : total), 0);
}
