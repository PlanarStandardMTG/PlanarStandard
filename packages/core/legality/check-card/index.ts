import type { Board, CardIndex, CardIssue, FormatRules, OracleId } from "@ps/contracts";

import { normalizeSetCode } from "../build-card-index/index";

export interface CardUnderTest {
  readonly cardName: string;
  readonly oracleId: OracleId | null;
  readonly boards: readonly Board[];
}

/**
 * One card against the pool, the banlist and the exceptions.
 *
 * **ADR 007: a card is legal if its oracle card has *any* printing in a legal
 * set, and any printing may then be played.** The printed set on the decklist
 * line is never consulted — `Llanowar Elves (M19)` is legal because the oracle
 * card is in FDN, and a Secret Lair printing of a legal card is just as legal.
 *
 * Precedence, in order:
 *   1. a ban beats everything, including an exception
 *   2. a `legal_exception` beats absence from the pool
 *   3. otherwise the oracle card must have a printing in a legal set
 */
export function checkCard(
  card: CardUnderTest,
  rules: FormatRules,
  index: CardIndex,
): CardIssue | null {
  if (card.oracleId === null) {
    return {
      kind: "card",
      code: "unresolved_name",
      cardName: card.cardName,
      oracleId: null,
      boards: card.boards,
      message: `"${card.cardName}" did not match any card in the dataset`,
    };
  }

  const ruling = rules.cardRules.get(card.oracleId);

  if (ruling?.ruling === "banned") {
    return {
      kind: "card",
      code: "banned",
      cardName: card.cardName,
      oracleId: card.oracleId,
      boards: card.boards,
      message: `${card.cardName} is banned${ruling.reason === null ? "" : ` (${ruling.reason})`}`,
    };
  }

  if (ruling?.ruling === "legal_exception") return null;

  return isInPool(card.oracleId, rules, index)
    ? null
    : {
        kind: "card",
        code: "not_in_pool",
        cardName: card.cardName,
        oracleId: card.oracleId,
        boards: card.boards,
        message: `${card.cardName} has no printing in a legal set`,
      };
}

/** Whether the oracle card has any printing inside the legal pool (ADR 007). */
export function isInPool(oracleId: OracleId, rules: FormatRules, index: CardIndex): boolean {
  const entry = index.byOracleId.get(oracleId);
  if (entry === undefined) return false;
  return entry.card.setCodes.some((setCode) => rules.legalSets.has(normalizeSetCode(setCode)));
}

/** The copy limit for one card: the format's, unless the card is restricted. */
export function copyLimit(oracleId: OracleId, rules: FormatRules): number {
  const ruling = rules.cardRules.get(oracleId);
  if (ruling?.ruling === "restricted") return ruling.limit;
  return rules.constraints.singleton ? 1 : rules.constraints.maxCopies;
}
