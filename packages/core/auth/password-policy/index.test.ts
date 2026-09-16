import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  checkPassword,
  utf8ByteLength,
  type PasswordProblem,
} from "./index";

function problemOf(raw: string): PasswordProblem {
  const result = checkPassword(raw);
  if (result.ok) throw new Error(`expected a problem for a password of length ${raw.length}`);
  return result.problem;
}

describe("checkPassword", () => {
  it("accepts an ordinary password", () => {
    expect(checkPassword("correct horse battery staple").ok).toBe(true);
    expect(checkPassword("a".repeat(PASSWORD_MIN_LENGTH)).ok).toBe(true);
  });

  it("refuses one below the minimum", () => {
    expect(problemOf("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe("too-short");
  });

  it("refuses a blank or whitespace-only password", () => {
    expect(problemOf("")).toBe("blank");
    // Long enough to pass the length check, and still nothing.
    expect(problemOf("          ")).toBe("blank");
  });

  it("refuses one past what bcrypt actually hashes", () => {
    expect(checkPassword("a".repeat(PASSWORD_MAX_BYTES)).ok).toBe(true);
    expect(problemOf("a".repeat(PASSWORD_MAX_BYTES + 1))).toBe("too-long");
  });

  it("measures the maximum in bytes, not characters", () => {
    // 18 emoji at four bytes each is 72 bytes and 36 UTF-16 code units. A
    // character count would wave this through and bcrypt would still cut it.
    const eighteen = "🜁".repeat(18);
    expect(utf8ByteLength(eighteen)).toBe(PASSWORD_MAX_BYTES);
    expect(checkPassword(eighteen).ok).toBe(true);
    expect(problemOf("🜁".repeat(19))).toBe("too-long");
  });

  it("counts UTF-8 bytes the way an encoder would", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    // Two bytes, three bytes, and a surrogate pair at four.
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("日")).toBe(3);
    expect(utf8ByteLength("🜁")).toBe(4);
    expect(utf8ByteLength("")).toBe(0);
  });

  it("does not require a number, a symbol, or a capital letter", () => {
    // Deliberate: complexity rules push people to `Password1!` and away from
    // length. See the README.
    expect(checkPassword("aaaaaaaaaaaaaaaaaaaa").ok).toBe(true);
  });

  it("keeps spaces inside a passphrase", () => {
    // Trimmed only to detect a blank, never to shorten what gets hashed.
    expect(checkPassword(" a pass phrase ").ok).toBe(true);
  });
});
