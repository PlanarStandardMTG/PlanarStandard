import { describe, expect, it } from "vitest";

import { checkRunDetails } from "./index";

const ok = { name: "Weekly #42", formatVersionIds: ["v1"], swissRounds: 3, topCut: 0 };

describe("core/runs/run-details", () => {
  it("accepts any structure the organizer chooses", () => {
    expect(checkRunDetails(ok)).toBeNull();
    expect(checkRunDetails({ ...ok, swissRounds: 0, topCut: 8 })).toBeNull();
    expect(checkRunDetails({ ...ok, swissRounds: 9, topCut: 3 })).toBeNull();
  });

  it("needs a name and a format version", () => {
    expect(checkRunDetails({ ...ok, name: "   " })).toBe("name-empty");
    expect(checkRunDetails({ ...ok, name: "x".repeat(121) })).toBe("name-long");
    expect(checkRunDetails({ ...ok, formatVersionIds: [] })).toBe("no-format");
  });

  it("refuses counts the database would, and a run with nothing to play", () => {
    expect(checkRunDetails({ ...ok, swissRounds: -1 })).toBe("swiss-rounds");
    expect(checkRunDetails({ ...ok, swissRounds: 2.5 })).toBe("swiss-rounds");
    expect(checkRunDetails({ ...ok, swissRounds: 21 })).toBe("swiss-rounds");
    expect(checkRunDetails({ ...ok, topCut: 513 })).toBe("top-cut");
    expect(checkRunDetails({ ...ok, swissRounds: 0, topCut: 1 })).toBe("nothing-to-play");
  });
});
