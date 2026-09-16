import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createPruner } from "./index";

const SCOPE = ["fdn", "dft", "tdm", "eoe", "ecl", "sos"];

/** Real Scryfall rows from the pool, one per layout that behaves differently. */
function sample(): readonly unknown[] {
  const path = fileURLToPath(
    new URL(
      "../../../../fixtures/scryfall/prune-sample.jsonl",
      import.meta.url,
    ),
  );
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as unknown);
}

function run(
  rows: readonly unknown[] = sample(),
  scope: readonly string[] = SCOPE,
) {
  const pruner = createPruner(scope);
  for (const row of rows) pruner.accept(row);
  return pruner.finish();
}

describe("createPruner", () => {
  it("matches the committed expected output", () => {
    const path = fileURLToPath(
      new URL(
        "../../../../fixtures/scryfall/prune-sample.expected.json",
        import.meta.url,
      ),
    );
    expect(run()).toEqual(JSON.parse(readFileSync(path, "utf8")));
  });

  it("keeps only sets in the fetch scope", () => {
    const result = run(sample(), ["fdn"]);
    expect(new Set(result.printings.map((p) => p.setCode))).toEqual(
      new Set(["fdn"]),
    );
    expect(result.stats.outOfScope).toBeGreaterThan(0);
  });

  it("unions the sets of a card legal through two of them", () => {
    const brokenWings = run().oracle.find((c) => c.name === "Broken Wings");
    expect(brokenWings?.setCodes).toEqual(["dft", "fdn"]);
  });

  it("emits one printing per set for that card, not one merged row", () => {
    expect(
      run().printings.filter(
        (p) => p.oracleId === findOracleId("Broken Wings"),
      ),
    ).toHaveLength(2);
  });

  // `reversible_card` rows carry no top-level oracle_id, cmc or type_line.
  it("drops reversible printings but keeps the card, which is reachable another way", () => {
    const result = run();
    expect(result.stats.droppedUnkeyed).toBe(1);
    expect(result.unreachableOracleIds).toEqual([]);
    expect(result.oracle.some((c) => c.name === "Hallowed Fountain")).toBe(
      true,
    );
    expect(result.printings.some((p) => p.collectorNumber === "347")).toBe(
      false,
    );
  });

  it("reports an oracle reachable ONLY through a dropped row rather than losing it", () => {
    const reversibleOnly = sample().filter(
      (row) => (row as { layout?: string }).layout === "reversible_card",
    );
    expect(run(reversibleOnly).unreachableOracleIds).toHaveLength(1);
  });

  it("keeps the joined cost on split-like layouts and the per-face costs too", () => {
    const prepared = run().oracle.find((c) => c.layout === "prepare");
    expect(prepared?.manaCost).toBe("{W} // {1}{W}");
    expect(prepared?.faces?.map((f) => f.manaCost)).toEqual(["{W}", "{1}{W}"]);
  });

  it("nulls the cost on transform, which prices each face separately", () => {
    const transform = run().oracle.find((c) => c.layout === "transform");
    expect(transform?.manaCost).toBeNull();
    expect(transform?.faces?.[0]?.manaCost).toBe("{2}{W}");
  });

  it("uses face images when the printing images its faces separately", () => {
    const result = run();
    const transformId = result.oracle.find(
      (c) => c.layout === "transform",
    )?.oracleId;
    const printing = result.printings.find((p) => p.oracleId === transformId);
    expect(printing?.imageUris).toBeNull();
    expect(printing?.faceImageUris).toHaveLength(2);
  });

  it("uses the single image on split-like layouts, which print one card", () => {
    const result = run();
    const prepareId = result.oracle.find(
      (c) => c.layout === "prepare",
    )?.oracleId;
    const printing = result.printings.find((p) => p.oracleId === prepareId);
    expect(printing?.imageUris?.normal).toContain("https://cards.scryfall.io/");
    expect(printing).not.toHaveProperty("faceImageUris");
  });

  it("nulls a land's empty mana cost rather than storing an empty string", () => {
    expect(run().oracle.find((c) => c.name === "Plains")?.manaCost).toBeNull();
  });

  it("sorts both arrays so an unchanged input produces an unchanged file", () => {
    const forward = run();
    const reversed = run([...sample()].reverse());
    expect(JSON.stringify(reversed)).toEqual(JSON.stringify(forward));
  });

  it("counts printings per set for the rebuild PR body", () => {
    expect(run().printingCountBySet).toEqual({
      dft: 2,
      ecl: 2,
      fdn: 2,
      sos: 1,
      tdm: 2,
    });
  });

  it.each([[null], [42], ["a string"], [[]], [{}], [{ set: "fdn" }]])(
    "survives a junk row without throwing: %j",
    (row) => {
      expect(() => run([row])).not.toThrow();
    },
  );

  it("drops a layout the fetch scope is not expected to contain", () => {
    expect(
      run([{ set: "fdn", layout: "art_series", oracle_id: "x" }]).stats
        .droppedLayout,
    ).toBe(1);
  });
});

function findOracleId(name: string): string | undefined {
  return run().oracle.find((c) => c.name === name)?.oracleId;
}
