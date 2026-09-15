import type { CardIndex, OracleId, ResolutionCandidate } from "@ps/contracts";

import { normalizeName } from "../../decklist/normalize-name/index";

export type Resolution =
  | { readonly ok: true; readonly oracleId: OracleId; readonly name: string }
  /** A miss, with "did you mean" candidates. Never a guess dressed up as a hit. */
  | { readonly ok: false; readonly candidates: readonly ResolutionCandidate[] };

/** Below this two names are not plausibly the same card, only vaguely similar. */
export const MIN_CANDIDATE_SCORE = 0.45;

/** More than a handful of suggestions is not help, it is a second problem. */
export const MAX_CANDIDATES = 5;

export interface ResolveOptions {
  readonly minScore?: number;
  readonly maxCandidates?: number;
}

/**
 * A decklist name to an oracle id.
 *
 * **An exact match always wins.** Fuzzy matching only runs when the normalized
 * name is not in the index at all, so a real card can never be displaced by a
 * better-scoring neighbour.
 *
 * A miss returns candidates rather than the best of them: picking one would put
 * a card the player did not register into their deck, and a wrong card is worse
 * than an unresolved one (E18.10 keeps the row and flags the deck).
 */
export function resolveCardName(
  printedName: string,
  index: CardIndex,
  options: ResolveOptions = {},
): Resolution {
  const normalized = normalizeName(printedName);
  if (normalized.length === 0) return { ok: false, candidates: [] };

  const exact = index.byNormalizedName.get(normalized);
  const first = exact?.[0];
  if (first !== undefined) {
    // A name keying more than one card is rare and always a face collision;
    // the first entry is the whole-name match, which is what was written.
    return { ok: true, oracleId: first, name: nameOf(index, first) ?? printedName };
  }

  return { ok: false, candidates: rank(normalized, index, options) };
}

function rank(
  normalized: string,
  index: CardIndex,
  options: ResolveOptions,
): readonly ResolutionCandidate[] {
  const minScore = options.minScore ?? MIN_CANDIDATE_SCORE;
  const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES;

  const scored: ResolutionCandidate[] = [];
  const seen = new Set<OracleId>();

  for (const [key, oracleIds] of index.byNormalizedName) {
    const score = similarity(normalized, key);
    if (score < minScore) continue;
    for (const oracleId of oracleIds) {
      if (seen.has(oracleId)) continue;
      seen.add(oracleId);
      scored.push({ oracleId, name: nameOf(index, oracleId) ?? key, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, maxCandidates);
}

function nameOf(index: CardIndex, oracleId: OracleId): string | undefined {
  return index.byOracleId.get(oracleId)?.card.name;
}

/**
 * Trigram Jaccard over the two normalized names.
 *
 * Deliberately a local copy rather than an import from `core/identity`, which
 * has the same algorithm for handles: legality has no business depending on
 * identity, and ten lines of a standard algorithm is a cheaper price than that
 * coupling.
 */
function similarity(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.add(padded.slice(i, i + 3));
  return grams;
}
