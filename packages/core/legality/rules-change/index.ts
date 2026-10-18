import type { DeckConstraints, FormatRules, OracleId } from "@ps/contracts";

import { copyLimit } from "../check-card/index";

/**
 * Which way an edit to a format version moved its rules. `narrowed` when a
 * deck legal before could now be illegal; `widened` when a deck illegal before
 * could now be legal. A rotation that adds sets and removes others is both.
 */
export interface RulesChange {
  readonly narrowed: boolean;
  readonly widened: boolean;
}

/**
 * Compare a version's rules before and after an admin's save (E20.72), so the
 * stored legality of every deck is only marked out of date when it can be.
 */
export function rulesChange(before: FormatRules, after: FormatRules): RulesChange {
  let narrowed = false;
  let widened = false;
  const note = (tighter: boolean, looser: boolean) => {
    narrowed ||= tighter;
    widened ||= looser;
  };

  for (const set of before.legalSets) note(!after.legalSets.has(set), false);
  for (const set of after.legalSets) note(false, !before.legalSets.has(set));

  for (const [was, now] of constraintPairs(before.constraints, after.constraints)) {
    note(now < was, now > was);
  }

  const ruled = new Set<OracleId>([...before.cardRules.keys(), ...after.cardRules.keys()]);
  for (const oracleId of ruled) {
    const was = allowance(before, oracleId);
    const now = allowance(after, oracleId);
    note(
      (now.banned && !was.banned) || (was.exception && !now.exception) || now.limit < was.limit,
      (was.banned && !now.banned) || (now.exception && !was.exception) || now.limit > was.limit,
    );
  }

  return { narrowed, widened };
}

/** Each constraint as `[before, after]`, oriented so a larger number allows more decks. */
function constraintPairs(
  before: DeckConstraints,
  after: DeckConstraints,
): readonly (readonly [number, number])[] {
  const copies = (c: DeckConstraints) => (c.singleton ? 1 : c.maxCopies);
  return [
    [-before.minMaindeck, -after.minMaindeck],
    [before.maxMaindeck ?? Infinity, after.maxMaindeck ?? Infinity],
    [before.maxSideboard, after.maxSideboard],
    [copies(before), copies(after)],
  ];
}

function allowance(rules: FormatRules, oracleId: OracleId) {
  const ruling = rules.cardRules.get(oracleId)?.ruling;
  return {
    banned: ruling === "banned",
    exception: ruling === "legal_exception",
    limit: copyLimit(oracleId, rules),
  };
}
