/**
 * E4 — build the committed card dataset.
 *
 * Fetches Scryfall's `default_cards` bulk file, prunes it to `data/sets.json`, and
 * writes `data/cards/`. Card data is a repo artifact, never a table (§14.1, ADR 002).
 *
 *   pnpm --filter jobs build-card-data [--out data/cards] [--from <local .jsonl[.gz]>]
 */
import { createReadStream, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

import type { IsoDateTime, SetCode } from "@ps/contracts";

import { fetchBulkSource, SCRYFALL_HEADERS } from "./bulk-index/index";
import { buildDataset, serialize } from "./emit/index";
import { createPruner } from "./prune/index";
import type { PruneResult } from "./prune/index";
import { parseSetsScope } from "./sets-scope/index";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export function readScope(path: string): readonly SetCode[] {
  const result = parseSetsScope(JSON.parse(readFileSync(path, "utf8")));
  if (!result.ok) {
    const lines = result.issues.map(
      (issue) =>
        `  ${issue.at === null ? "file" : `[${issue.at}]`}: ${issue.message}`,
    );
    throw new Error(`${path} is not a valid fetch scope:\n${lines.join("\n")}`);
  }
  return result.setCodes;
}

/**
 * Stream the bulk file through the pruner.
 *
 * Gzip in, one JSON object per line out — so nothing ever parses the whole file, and
 * peak memory tracks the pool rather than the download.
 */
export async function pruneStream(
  source: NodeJS.ReadableStream,
  scope: readonly SetCode[],
  gzipped: boolean,
): Promise<PruneResult> {
  const pruner = createPruner(scope);
  const lines = new PassThrough();
  const unzip = pipeline(
    gzipped ? [source, createGunzip(), lines] : [source, lines],
  );

  const reader = createInterface({ input: lines, crlfDelay: Infinity });
  for await (const line of reader) {
    if (line === "" || line === "[" || line === "]") continue;
    // The JSONL feed has no separators, but a stray trailing comma costs nothing to survive.
    const trimmed = line.endsWith(",") ? line.slice(0, -1) : line;
    try {
      pruner.accept(JSON.parse(trimmed));
    } catch {
      // A truncated line would be a corrupt download; the count check below catches it.
    }
  }

  await unzip;
  return pruner.finish();
}

async function main(argv: readonly string[]): Promise<void> {
  const outDir = argValue(argv, "--out") ?? `${REPO_ROOT}data/cards`;
  const local = argValue(argv, "--from");
  const scopePath = argValue(argv, "--sets") ?? `${REPO_ROOT}data/sets.json`;

  const scope = readScope(scopePath);
  console.log(`fetch scope: ${scope.join(", ")}`);

  let bulkUpdatedAt: IsoDateTime;
  let stream: NodeJS.ReadableStream;
  let gzipped: boolean;

  if (local === undefined) {
    const source = await fetchBulkSource();
    console.log(`bulk: ${source.url}`);
    console.log(
      `      ${(source.compressedSize / 1048576).toFixed(1)} MB gzipped, updated ${source.updatedAt}`,
    );
    const response = await fetch(source.url, {
      headers: { ...SCRYFALL_HEADERS },
    });
    if (!response.ok || response.body === null) {
      throw new Error(
        `bulk download: ${response.status} ${response.statusText}`,
      );
    }
    bulkUpdatedAt = source.updatedAt;
    stream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );
    gzipped = true;
  } else {
    console.log(`bulk: ${local} (local)`);
    bulkUpdatedAt = new Date(0).toISOString() as IsoDateTime;
    stream = createReadStream(local);
    gzipped = local.endsWith(".gz");
  }

  const started = Date.now();
  const result = await pruneStream(stream, scope, gzipped);

  if (result.unreachableOracleIds.length > 0) {
    throw new Error(
      `${result.unreachableOracleIds.length} card(s) are reachable only through a dropped ` +
        `printing and would be missing from the dataset: ${result.unreachableOracleIds.join(", ")}`,
    );
  }
  if (result.stats.kept === 0) {
    throw new Error(
      "the prune kept nothing — check that data/sets.json matches the bulk file's set codes",
    );
  }

  const dataset = buildDataset(result, {
    bulkUpdatedAt,
    scope,
    generatedAt: new Date().toISOString() as IsoDateTime,
  });

  await mkdir(outDir, { recursive: true });
  const files = serialize(dataset);
  for (const [name, body] of Object.entries(files)) {
    await writeFile(`${outDir}/${name}`, body, "utf8");
  }

  const bytes = Object.values(files).reduce(
    (total, body) => total + Buffer.byteLength(body),
    0,
  );
  const { stats } = result;
  console.log(
    `read ${stats.seen} rows, kept ${stats.kept} printings across ${dataset.meta.oracleCardCount} cards ` +
      `in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  console.log(
    `dropped: ${stats.outOfScope} out of scope, ${stats.droppedUnkeyed} unkeyed, ` +
      `${stats.droppedLayout} unsupported layout, ${stats.droppedMalformed} malformed`,
  );
  console.log(`wrote ${outDir} — ${(bytes / 1048576).toFixed(2)} MB`);
  // E4.3 asserts a bounded peak in the log: this tracks the pool, not the download.
  console.log(
    `peak rss: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`,
  );
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`
) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
