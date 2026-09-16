import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publishedBody, readGeneratedRegion, writeGeneratedRegion } from "./published-source";

/**
 * `pnpm content:sync` — rewrites the generated region of every MDX page that has
 * one, from the module doc it names.
 *
 * The drift test (E17.12) runs the same comparison and fails when a definition
 * has been changed in one place only. This is the other half of it: the fix is a
 * command rather than a copy-paste.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PAGES_DIR = join(REPO_ROOT, "content/pages");

export interface SyncResult {
  readonly page: string;
  readonly source: string;
  readonly changed: boolean;
}

export function syncContent({ write }: { write: boolean }): SyncResult[] {
  const results: SyncResult[] = [];

  for (const entry of readdirSync(PAGES_DIR).sort()) {
    const file = join(PAGES_DIR, entry);
    if (!entry.endsWith(".mdx") || !statSync(file).isFile()) continue;

    const mdx = readFileSync(file, "utf8");
    const region = readGeneratedRegion(mdx);
    if (region === null) continue;

    const expected = publishedBody(readFileSync(join(REPO_ROOT, region.source), "utf8"));
    const changed = expected !== region.body;
    if (changed && write) writeFileSync(file, writeGeneratedRegion(mdx, expected));

    results.push({ page: relative(REPO_ROOT, file), source: region.source, changed });
  }

  return results;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const results = syncContent({ write: true });
  const changed = results.filter((result) => result.changed);
  for (const result of results) {
    console.log(
      `${result.changed ? "updated" : "  up to date"}  ${result.page}  <- ${result.source}`,
    );
  }
  console.log(`${changed.length} of ${results.length} generated regions rewritten.`);
}
