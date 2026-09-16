/**
 * E1.8 — `pnpm new:module core/metrics/mana-curve` scaffolds one module.
 *
 * A module is one directory, one responsibility, one test file (§6): `index.ts`,
 * `index.test.ts`, and a 3-10 line `README.md`. The generated test fails on
 * purpose — a scaffold that ships green invites someone to forget to write it.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where a path prefix lands, and what that package is allowed to depend on. */
const PACKAGE_ROOTS: ReadonlyArray<{ prefix: string; dir: string; note: string }> = [
  {
    prefix: "contracts",
    dir: "packages/contracts",
    note: "Types only — no runtime code, no dependencies.",
  },
  {
    prefix: "core",
    dir: "packages/core",
    note: "Pure. Never imports db, next, react or @supabase/*; data arrives as an argument.",
  },
  {
    prefix: "adapters",
    dir: "packages/adapters",
    note: "Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.",
  },
  {
    prefix: "db",
    dir: "packages/db",
    note: "Narrow, intention-revealing repository functions. No SQL string escapes this module.",
  },
  {
    prefix: "web",
    dir: "apps/web",
    note: "Thin coordinator. Business logic belongs in core, not here.",
  },
  { prefix: "jobs", dir: "apps/jobs", note: "Scheduled script. Never imported by apps/web." },
];

const USAGE = `usage: pnpm new:module <package>/<path...>/<name>

  pnpm new:module core/metrics/mana-curve
  pnpm new:module core/identity/signals/nickname
  pnpm new:module adapters/challonge-csv

packages: ${PACKAGE_ROOTS.map((r) => r.prefix).join(", ")}`;

function titleCase(slug: string): string {
  return slug.replace(/-/g, " ");
}

function camelCase(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function indexSource(name: string, note: string): string {
  return `// ${note}
// Docs: docs/modules/${name}.md · README.md next to this file.

export function ${camelCase(name)}(): never {
  throw new Error("${name} is not implemented yet");
}
`;
}

function testSource(name: string, specifier: string): string {
  return `import { describe, expect, it } from "vitest";

import { ${camelCase(name)} } from "./index";

describe("${specifier}", () => {
  // Red on purpose: the scaffold hands you a failing test so you cannot merge
  // an empty module. Replace it with the happy path plus every edge case,
  // using fixtures/ where real data exists.
  it("does what its README says", () => {
    expect(${camelCase(name)}()).toBeDefined();
  });
});
`;
}

function readmeSource(name: string, specifier: string): string {
  return `# ${titleCase(name)}

**Purpose.** One sentence, no "and". If it needs an "and", this is two modules.

**Inputs.** What it takes, and where that comes from.

**Outputs.** What it returns, and which contract type that is.

**Gotchas.** The real-world quirk this module exists to survive, or the ADR the
behaviour comes from. Delete the heading if there genuinely isn't one.

\`pnpm --filter ${specifier.split("/")[0]} test -- ${name}\`
`;
}

function main(): number {
  const specifier = process.argv[2];
  if (specifier === undefined || specifier === "--help" || specifier === "-h") {
    console.log(USAGE);
    return specifier === undefined ? 1 : 0;
  }

  const segments = specifier.split("/").filter((s) => s.length > 0);
  const [prefix, ...rest] = segments;
  const root = PACKAGE_ROOTS.find((r) => r.prefix === prefix);
  if (root === undefined || rest.length === 0) {
    console.error(`unrecognised module path: ${specifier}\n\n${USAGE}`);
    return 1;
  }

  const name = rest[rest.length - 1] as string;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    console.error(`module names are kebab-case: got "${name}"`);
    return 1;
  }

  const dir = join(REPO_ROOT, root.dir, ...rest);
  if (existsSync(dir)) {
    console.error(`${root.dir}/${rest.join("/")} already exists`);
    return 1;
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.ts"), indexSource(name, root.note));
  writeFileSync(join(dir, "index.test.ts"), testSource(name, specifier));
  writeFileSync(join(dir, "README.md"), readmeSource(name, specifier));

  const created = `${root.dir}/${rest.join("/")}`;
  console.log(`created ${created}/`);
  console.log(`  index.ts       ${root.note}`);
  console.log(`  index.test.ts  fails until you write it`);
  console.log(`  README.md      purpose, inputs, outputs, gotchas`);
  console.log(`\nexport it from ${root.dir}/index.ts when it does something.`);
  return 0;
}

process.exitCode = main();
