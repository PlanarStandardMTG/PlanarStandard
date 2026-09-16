import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * E13.14's other half: the index table in `docs/modules/indexes.md` has to keep
 * agreeing with the migrations.
 *
 * A documented index that no longer exists sends the next person looking for a
 * plan that cannot happen; an index nobody documented is one nobody can argue
 * with. Both are the kind of drift a table of thirty-odd rows accumulates
 * quietly, so this asserts the two sets are equal rather than trusting a review.
 *
 * Reads files and no database, so it runs with the rest of the suite whether or
 * not anything is listening.
 */
const migrationsDir = new URL("./migrations/", import.meta.url);
const doc = readFileSync(new URL("../../docs/modules/indexes.md", import.meta.url), "utf8");

function migrationIndexes(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const file of readdirSync(migrationsDir).sort()) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8");
    for (const [, name] of sql.matchAll(/create\s+(?:unique\s+)?index\s+([a-z0-9_]+)/gi)) {
      names.add(name as string);
    }
  }
  return names;
}

/**
 * The second column of the "Every index" table, which is the only place the doc
 * names one. `(platform, normalized)` is a unique **constraint** rather than a
 * `create index`, so it is listed with its columns and skipped here.
 */
function documentedIndexes(): ReadonlySet<string> {
  const table = doc.split("## Every index, and what it is for")[1] ?? "";
  const names = new Set<string>();
  for (const line of table.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const column = line.split("|")[2] ?? "";
    for (const [, name] of column.matchAll(/`([a-z][a-z0-9_]*)`/g)) names.add(name as string);
  }
  return names;
}

describe("the index review stays true (E13.14)", () => {
  it("documents every index the migrations create", () => {
    const undocumented = [...migrationIndexes()].filter((name) => !documentedIndexes().has(name));
    expect(undocumented, "add these to docs/modules/indexes.md").toEqual([]);
  });

  it("claims no index the migrations do not create", () => {
    const missing = [...documentedIndexes()].filter((name) => !migrationIndexes().has(name));
    expect(missing, "these are in docs/modules/indexes.md and nowhere else").toEqual([]);
  });

  it("found something to check, rather than passing on two empty sets", () => {
    expect(migrationIndexes().size).toBeGreaterThan(25);
  });
});
