import { describe, expect, it } from "vitest";

import { HANDLE_MAX_LENGTH, checkProfileHandle } from "./index";

function accepted(raw: string): string {
  const result = checkProfileHandle(raw);
  if (!result.ok) throw new Error(`expected ${raw} to be accepted: ${result.problem}`);
  return result.handle;
}

function rejected(raw: string): string {
  const result = checkProfileHandle(raw);
  if (result.ok) throw new Error(`expected ${raw} to be rejected, got ${result.handle}`);
  return result.problem;
}

describe("checkProfileHandle", () => {
  it("accepts an ordinary handle", () => {
    expect(accepted("wrenfield")).toBe("wrenfield");
    expect(accepted("tam_tallowmere")).toBe("tam_tallowmere");
    expect(accepted("deck-o-matic-9000")).toBe("deck-o-matic-9000");
  });

  it("folds case and surrounding space", () => {
    // Two people cannot own the same URL in different capitalisations, so the
    // claim is settled here rather than by a unique index over raw text.
    expect(accepted("  WrenField  ")).toBe("wrenfield");
  });

  it("refuses one that is too short or too long", () => {
    expect(rejected("ab")).toBe("too-short");
    expect(rejected("a".repeat(HANDLE_MAX_LENGTH + 1))).toBe("too-long");
    expect(accepted("a".repeat(HANDLE_MAX_LENGTH))).toHaveLength(HANDLE_MAX_LENGTH);
  });

  it("refuses characters that do not belong in a URL", () => {
    expect(rejected("wren field")).toBe("charset");
    expect(rejected("wren.field")).toBe("charset");
    expect(rejected("wren/field")).toBe("charset");
    expect(rejected("wren@field")).toBe("charset");
    expect(rejected("wrenfíeld")).toBe("charset");
  });

  it("refuses a handle that starts or ends with punctuation", () => {
    expect(rejected("-wren")).toBe("charset");
    expect(rejected("wren-")).toBe("charset");
    expect(rejected("_wren")).toBe("charset");
  });

  it("refuses a handle that would shadow a route", () => {
    expect(rejected("events")).toBe("reserved");
    expect(rejected("login")).toBe("reserved");
  });

  it("refuses a handle that claims an authority nobody granted", () => {
    // `role` is admin-only for good reasons; `/@admin` would route around all of
    // them by just looking official.
    expect(rejected("admin")).toBe("reserved");
    expect(rejected("PlanarStandard")).toBe("reserved");
    expect(rejected("staff")).toBe("reserved");
  });
});
