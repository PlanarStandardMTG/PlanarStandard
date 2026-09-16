import type { SetCode } from "@ps/contracts";

/**
 * `data/sets.json` is the fetch scope — every set the committed dataset carries.
 * It is not `format_legal_sets`, which is the legal pool and lives in the database
 * so a B&R announcement never needs a deploy (§14.1).
 */
export type SetsScopeIssue = {
  /** Index into the source array, or null for a whole-file problem. */
  readonly at: number | null;
  readonly message: string;
};

export type SetsScopeResult =
  | { readonly ok: true; readonly setCodes: readonly SetCode[] }
  | { readonly ok: false; readonly issues: readonly SetsScopeIssue[] };

/** Scryfall set codes are three to six alphanumerics: `fdn`, `tdm`, `pltr`, `plst`. */
const SET_CODE = /^[a-z0-9]{3,6}$/;

/**
 * Validate the fetch scope and lower-case it.
 *
 * The file is written upper-case because that is how a human reads a set code and
 * how the seed SQL writes it; every lookup keyed by a set code is lower-case
 * (`normalizeSetCode`), so the boundary converts once, here.
 */
export function parseSetsScope(raw: unknown): SetsScopeResult {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      issues: [{ at: null, message: "expected a JSON array of set codes" }],
    };
  }
  if (raw.length === 0) {
    return {
      ok: false,
      issues: [
        {
          at: null,
          message: "fetch scope is empty — the build would emit no cards",
        },
      ],
    };
  }

  const issues: SetsScopeIssue[] = [];
  const setCodes: SetCode[] = [];
  const seen = new Map<string, number>();

  for (const [at, entry] of raw.entries()) {
    if (typeof entry !== "string") {
      issues.push({
        at,
        message: `expected a string, got ${entry === null ? "null" : typeof entry}`,
      });
      continue;
    }

    const code = entry.trim().toLowerCase();
    if (!SET_CODE.test(code)) {
      issues.push({
        at,
        message: `${JSON.stringify(entry)} is not a set code (three to six alphanumerics)`,
      });
      continue;
    }

    const first = seen.get(code);
    if (first !== undefined) {
      issues.push({
        at,
        message: `${JSON.stringify(entry)} duplicates the entry at index ${first}`,
      });
      continue;
    }

    seen.set(code, at);
    setCodes.push(code);
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, setCodes };
}
