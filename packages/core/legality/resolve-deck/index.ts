import type { CardIndex, ParsedDeck, ResolvedCard, ResolvedDeck } from "@ps/contracts";

import { resolveCardName, type ResolveOptions } from "../resolve-card-name/index";

/**
 * Every line of a parsed deck against the card index.
 *
 * A miss keeps its line with a null `oracleId` and its "did you mean"
 * candidates (E18.10). `set` and `collector` ride along as provenance and are
 * never used to resolve (ADR 007). The printed name is kept as written; the
 * index's spelling is what `oracleId` points at.
 */
export function resolveDeck(
  deck: ParsedDeck,
  index: CardIndex,
  options: ResolveOptions = {},
): ResolvedDeck {
  const cards = deck.lines.map((line): ResolvedCard => {
    const resolution = resolveCardName(line.name, index, options);
    return {
      qty: line.qty,
      name: line.name,
      oracleId: resolution.ok ? resolution.oracleId : null,
      ...(line.set === undefined ? {} : { set: line.set }),
      ...(line.collector === undefined ? {} : { collector: line.collector }),
      foil: line.foil,
      board: line.board,
      lineNumber: line.lineNumber,
      ...(resolution.ok ? {} : { candidates: resolution.candidates }),
    };
  });

  return {
    cards,
    issues: deck.issues,
    hasUnresolvedCards: cards.some((card) => card.oracleId === null),
  };
}
