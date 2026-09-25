import type { IdentityId, NewMatch, ParseIssue, ParsedMatch } from "@ps/contracts";

/**
 * Parsed pairings → the rows `matches` will hold, given each handle's identity
 * (E18.20). A row that cannot be committed is left out and named in an issue,
 * never guessed into shape: a match with no result, or with a side whose handle
 * did not resolve (`core/identity/resolve-handles` refused it).
 */
export interface LedgerMatches {
  readonly matches: readonly NewMatch[];
  readonly issues: readonly ParseIssue[];
}

export function ledgerMatches(
  parsed: readonly ParsedMatch[],
  identities: ReadonlyMap<string, IdentityId>,
): LedgerMatches {
  const matches: NewMatch[] = [];
  const issues: ParseIssue[] = [];

  for (const match of parsed) {
    const skip = (code: string, message: string) =>
      issues.push({ code, severity: "warning", message, rowIndex: match.rowIndex });

    if (match.result === null) {
      skip("no-result", "The match has no result, so it is not committed.");
      continue;
    }
    const p1 = identities.get(match.p1Handle);
    const p2 = match.p2Handle === undefined ? null : identities.get(match.p2Handle);
    if (p1 === undefined || p2 === undefined) {
      skip("unresolved-handle", "A player in this match has no identity, so it is not committed.");
      continue;
    }

    matches.push({
      sourceImportId: null,
      round: match.round ?? 1,
      tableNumber: match.tableNumber ?? null,
      p1IdentityId: p1,
      p2IdentityId: p2,
      p1Games: match.p1Games ?? 0,
      p2Games: match.p2Games ?? 0,
      gameDraws: match.gameDraws ?? 0,
      result: match.result,
      isElimination: match.isElimination ?? false,
    });
  }

  return { matches, issues };
}
