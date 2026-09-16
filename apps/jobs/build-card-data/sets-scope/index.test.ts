import { describe, expect, it } from "vitest";

import { parseSetsScope } from "./index";

/** The committed scope, so a bad edit to `data/sets.json` fails this test. */
import setsJson from "../../../../data/sets.json";

describe("parseSetsScope", () => {
  it("lower-cases the upper-case codes the file is written in", () => {
    expect(parseSetsScope(["FDN", "DFT"])).toEqual({
      ok: true,
      setCodes: ["fdn", "dft"],
    });
  });

  it("keeps the file's order rather than sorting", () => {
    const result = parseSetsScope(["SOS", "FDN"]);
    expect(result.ok && result.setCodes).toEqual(["sos", "fdn"]);
  });

  it("accepts the committed data/sets.json", () => {
    const result = parseSetsScope(setsJson);
    expect(result.ok).toBe(true);
  });

  it("rejects an empty scope, which would emit no cards at all", () => {
    const result = parseSetsScope([]);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          at: null,
          message: "fetch scope is empty — the build would emit no cards",
        },
      ],
    });
  });

  it("rejects a duplicate, naming the index it first appeared at", () => {
    const result = parseSetsScope(["FDN", "DFT", "fdn"]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues).toEqual([
      { at: 2, message: '"fdn" duplicates the entry at index 0' },
    ]);
  });

  it("rejects a set name written where a code belongs", () => {
    const result = parseSetsScope(["Foundations"]);
    expect(!result.ok && result.issues[0]?.message).toContain(
      "is not a set code",
    );
  });

  it.each([[["FDN", 7]], [[null]], [[["FDN"]]]])(
    "rejects a non-string entry: %j",
    (raw) => {
      expect(parseSetsScope(raw).ok).toBe(false);
    },
  );

  it("rejects a JSON object, which is the shape a reason field would have made it", () => {
    expect(parseSetsScope({ FDN: "core set" }).ok).toBe(false);
  });

  it("reports every bad entry at once rather than stopping at the first", () => {
    const result = parseSetsScope(["Foundations", "x", "FDN", "FDN"]);
    expect(!result.ok && result.issues).toHaveLength(3);
  });
});
