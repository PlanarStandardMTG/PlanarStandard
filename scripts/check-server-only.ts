/**
 * E1.7 — `SUPABASE_SERVICE_ROLE_KEY` must be unreachable from any client bundle.
 *
 * Two rules, both enforced here because `dependency-cruiser` matches on paths and
 * cannot see a `'use client'` directive:
 *
 *   1. Only a server-only module may name the key at all.
 *   2. Nothing transitively reachable from a `'use client'` module may be a
 *      server-only module — a client bundle that can import one can leak it.
 *
 * A module is server-only when its path is `*.server.ts` or sits under a
 * `server-only/` directory. `.dependency-cruiser.cjs` keeps those out of
 * `packages/*` in the first place; this script covers the client boundary.
 *
 * Run `tsx scripts/check-server-only.ts` to scan the repo, or `--self-test` to
 * assert the checker still catches a known violation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", ".next", ".git", ".turbo", "coverage"]);

const SERVER_ONLY = /(?:\.server\.[cm]?[jt]sx?$)|(?:[\\/]server-only[\\/])/;
const USE_CLIENT = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*["']use client["']/;
const IMPORT_SOURCE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

export interface Violation {
  readonly file: string;
  readonly rule: "key-outside-server-only" | "client-reaches-server-only";
  readonly message: string;
}

function listSourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // a root that does not exist yet is not a violation
    }
    for (const entry of entries) {
      if (SKIP_DIRECTORIES.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(full);
    }
  };
  walk(root);
  return found;
}

/**
 * The nearest ancestor holding a `tsconfig.json` — the root a `@/` alias is
 * relative to. Found by walking up rather than hard-coded, so a second app needs
 * no change here.
 */
function aliasRoot(fromFile: string): string | null {
  let dir = dirname(fromFile);
  while (dir.startsWith(REPO_ROOT)) {
    try {
      if (statSync(join(dir, "tsconfig.json")).isFile()) return dir;
    } catch {
      // keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else if (specifier.startsWith("@/")) {
    // Next's own convention, and what every import in `apps/web` uses. Missed
    // here, the guard would pass a client component that imports the key
    // directly — which is the whole thing it exists to prevent.
    const root = aliasRoot(fromFile);
    if (root === null) return null;
    base = resolve(root, specifier.slice(2));
  } else {
    return null; // workspace and npm deps are depcruise's job
  }

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...SOURCE_EXTENSIONS.map((ext) => join(base, "index" + ext)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function importsOf(file: string, source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_SOURCE)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    const resolved = resolveImport(file, specifier);
    if (resolved !== null) out.push(resolved);
  }
  return out;
}

/** The guard names the key in order to search for it; scanning itself is a false positive. */
const SELF = fileURLToPath(import.meta.url);

export function checkServerOnly(roots: readonly string[], repoRoot = REPO_ROOT): Violation[] {
  const files = roots
    .flatMap((root) => listSourceFiles(resolve(repoRoot, root)))
    .filter((f) => f !== SELF);
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const rel = (file: string): string => relative(repoRoot, file);
  const violations: Violation[] = [];

  for (const [file, source] of sources) {
    if (source.includes(SERVICE_ROLE_KEY) && !SERVER_ONLY.test(file)) {
      violations.push({
        file: rel(file),
        rule: "key-outside-server-only",
        message: `names ${SERVICE_ROLE_KEY} but is not a server-only module (\`*.server.ts\` or under \`server-only/\`)`,
      });
    }
  }

  for (const [entry, source] of sources) {
    if (!USE_CLIENT.test(source)) continue;
    const seen = new Set<string>([entry]);
    const queue = [entry];
    const path = new Map<string, string[]>([[entry, [entry]]]);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const trail = path.get(current) as string[];
      for (const next of importsOf(
        current,
        sources.get(current) ?? readFileSync(current, "utf8"),
      )) {
        if (seen.has(next)) continue;
        seen.add(next);
        const nextTrail = [...trail, next];
        path.set(next, nextTrail);
        if (SERVER_ONLY.test(next) || (sources.get(next) ?? "").includes(SERVICE_ROLE_KEY)) {
          violations.push({
            file: rel(entry),
            rule: "client-reaches-server-only",
            message: `is a 'use client' module that reaches ${rel(next)} via ${nextTrail.map(rel).join(" -> ")}`,
          });
          continue; // one report per client entry per offending module is enough
        }
        queue.push(next);
      }
    }
  }

  return violations;
}

function report(violations: readonly Violation[]): void {
  for (const violation of violations) {
    console.error(`  ${violation.file}\n    ${violation.rule}: ${violation.message}`);
  }
}

function selfTest(): number {
  const clean = checkServerOnly(["fixtures/server-only-guard/clean"]);
  const violating = checkServerOnly(["fixtures/server-only-guard/violating"]);
  const aliased = checkServerOnly(["fixtures/server-only-guard/aliased"]);
  const failures: string[] = [];
  if (clean.length > 0)
    failures.push(`the clean fixture tripped the guard: ${JSON.stringify(clean)}`);
  if (!violating.some((v) => v.rule === "key-outside-server-only"))
    failures.push("the violating fixture did not trip rule key-outside-server-only");
  if (!violating.some((v) => v.rule === "client-reaches-server-only"))
    failures.push("the violating fixture did not trip rule client-reaches-server-only");
  if (!aliased.some((v) => v.rule === "client-reaches-server-only"))
    failures.push(
      "the aliased fixture did not trip rule client-reaches-server-only via a `@/` import",
    );
  if (failures.length > 0) {
    console.error("server-only guard self-test FAILED:");
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }
  console.log(
    "server-only guard self-test passed (clean fixture clean; relative and `@/` violations both caught).",
  );
  return 0;
}

function main(): number {
  if (process.argv.includes("--self-test")) return selfTest();

  const selfTestExit = selfTest();
  if (selfTestExit !== 0) return selfTestExit;

  const violations = checkServerOnly(["apps", "packages", "scripts"]);
  if (violations.length > 0) {
    console.error(`\n${SERVICE_ROLE_KEY} is reachable from a client bundle:`);
    report(violations);
    console.error(
      "\nMove the key behind a `*.server.ts` module, or stop importing that module from a 'use client' file.",
    );
    return 1;
  }
  console.log(`${SERVICE_ROLE_KEY} is confined to server-only modules.`);
  return 0;
}

process.exitCode = main();
