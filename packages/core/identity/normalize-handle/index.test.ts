import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizeHandle } from "./index";

/**
 * The shared parity table. `packages/db/generated-columns.test.ts` reads the same
 * file and asserts the generated column on `player_identities` against it, which
 * is how the acceptance criterion is met without either package importing the
 * other: parity is checked against Postgres itself, not against a list somebody
 * typed out twice.
 */
const POSTGRES_PARITY: ReadonlyArray<{ handle: string; normalized: string }> = JSON.parse(
  readFileSync(
    new URL("../../../../fixtures/identity/normalized-handles.json", import.meta.url),
    "utf8",
  ),
);

describe("core/identity/normalize-handle", () => {
  it.each(POSTGRES_PARITY)("normalizes $handle the way Postgres does", ({ handle, normalized }) => {
    expect(normalizeHandle(handle)).toBe(normalized);
  });

  it("folds the two real spellings of one handle together", () => {
    // Both appear in the Season II ledger.
    expect(normalizeHandle("DreamsAlong")).toBe(normalizeHandle("Dreamsalong"));
  });

  it("strips before lowercasing, as the SQL expression does", () => {
    // Order matters outside ASCII: 'İ' lowercases to two code points in
    // JavaScript, and only one of them is in [a-zA-Z0-9].
    expect(normalizeHandle("İstanbul")).toBe("stanbul");
  });

  it("is idempotent", () => {
    for (const { handle } of POSTGRES_PARITY) {
      const once = normalizeHandle(handle);
      expect(normalizeHandle(once)).toBe(once);
    }
  });
});
