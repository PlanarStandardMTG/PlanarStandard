import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { IsoDateTime } from "@ps/contracts";

import { buildDataset, serialize } from "./index";
import type { PruneResult } from "../prune/index";

const RESULT = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../fixtures/scryfall/prune-sample.expected.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as PruneResult;

const INPUT = {
  bulkUpdatedAt: "2026-09-15T21:01:51.902+00:00" as IsoDateTime,
  scope: ["fdn", "dft", "tdm", "eoe", "ecl", "sos"],
  generatedAt: "2026-09-15T22:00:00.000Z" as IsoDateTime,
};

describe("buildDataset", () => {
  it("records the bulk timestamp as provenance, not the run time", () => {
    const { meta } = buildDataset(RESULT, INPUT);
    expect(meta.bulkUpdatedAt).toBe(INPUT.bulkUpdatedAt);
    expect(meta.generatedAt).toBe(INPUT.generatedAt);
  });

  it("records the fetch scope, including sets that matched nothing", () => {
    const { meta } = buildDataset(RESULT, INPUT);
    expect(meta.setCodes).toEqual(INPUT.scope);
    expect(meta.printingCountBySet["eoe"]).toBeUndefined();
  });

  it("counts what it actually emitted", () => {
    const { meta } = buildDataset(RESULT, INPUT);
    expect(meta.oracleCardCount).toBe(RESULT.oracle.length);
    expect(meta.printingCount).toBe(RESULT.printings.length);
  });

  it("carries the Scryfall attribution their terms require", () => {
    expect(buildDataset(RESULT, INPUT).meta.attribution.source).toBe(
      "Scryfall",
    );
  });

  it("sorts the per-set counts so the key order never churns", () => {
    const keys = Object.keys(
      buildDataset(RESULT, INPUT).meta.printingCountBySet,
    );
    expect(keys).toEqual([...keys].sort());
  });
});

describe("serialize", () => {
  it("emits the two data files byte-identically for unchanged input", () => {
    const early = serialize(buildDataset(RESULT, INPUT));
    const later = serialize(
      buildDataset(RESULT, {
        ...INPUT,
        generatedAt: "2026-12-25T03:00:00.000Z" as IsoDateTime,
      }),
    );

    expect(later["oracle.json"]).toBe(early["oracle.json"]);
    expect(later["printings.json"]).toBe(early["printings.json"]);
    // meta.json carries the run date, so it is the one file that always differs.
    expect(later["meta.json"]).not.toBe(early["meta.json"]);
  });

  it("ends every file with a newline so diffs stay clean", () => {
    for (const body of Object.values(serialize(buildDataset(RESULT, INPUT)))) {
      expect(body.endsWith("\n")).toBe(true);
    }
  });

  it("round-trips through JSON.parse", () => {
    const files = serialize(buildDataset(RESULT, INPUT));
    expect(JSON.parse(files["oracle.json"])).toEqual(RESULT.oracle);
    expect(JSON.parse(files["printings.json"])).toEqual(RESULT.printings);
  });
});
