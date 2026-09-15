import { describe, expect, it } from "vitest";

import { normalizeHandle } from "./index";

/**
 * Each row is what Postgres produces for
 * `lower(regexp_replace(handle,'[^a-zA-Z0-9]','','g'))` — the generated column
 * on player_identities. Parity with that expression is the acceptance criterion.
 */
const POSTGRES_PARITY: ReadonlyArray<readonly [handle: string, normalized: string]> = [
  ["serlupidus", "serlupidus"],
  ["Sunsett", "sunsett"],
  ["c0d33", "c0d33"],
  ["Moss Knight", "mossknight"],
  ["Flod_Lawjick", "flodlawjick"],
  ["Solarian_13", "solarian13"],
  ["Oseoros(Rus)", "oseorosrus"],
  ["100beep", "100beep"],
  ["TheOneWhoIsRed", "theonewhoisred"],
  ["Rasone77", "rasone77"],
  // Everything outside [a-zA-Z0-9] goes, accents and emoji included.
  ["Márton", "mrton"],
  ["player✨", "player"],
  ["  spaced  out  ", "spacedout"],
  ["---", ""],
  ["", ""],
];

describe("core/identity/normalize-handle", () => {
  it.each(POSTGRES_PARITY)("normalizes %o the way Postgres does", (handle, expected) => {
    expect(normalizeHandle(handle)).toBe(expected);
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
    for (const [handle] of POSTGRES_PARITY) {
      const once = normalizeHandle(handle);
      expect(normalizeHandle(once)).toBe(once);
    }
  });
});
