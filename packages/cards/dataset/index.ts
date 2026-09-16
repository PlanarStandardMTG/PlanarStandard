import { readFileSync } from "node:fs";

import type {
  CardDataset,
  CardDatasetMeta,
  CardIndex,
  CardPrinting,
  OracleCard,
} from "@ps/contracts";
import { buildCardIndex } from "@ps/core";

/**
 * Load the committed card artifact, once per process.
 *
 * `core` does no file I/O and `web` cannot import `jobs`, so the loader lives in
 * neither and both use this (§5, §8, E4.7). Nothing here filters or looks
 * anything up — that is `build-card-index`, which takes the dataset as an
 * argument and stays pure.
 *
 * Reads are synchronous and deliberately so. It happens once, the files are
 * about 2.4 MB, and an async loader would make every caller async to save a few
 * milliseconds on one call in the life of the process.
 */

/** The repo's `data/cards/`, resolved from this file rather than from `cwd`. */
const DEFAULT_DIR = new URL("../../../data/cards/", import.meta.url);

const datasets = new Map<string, CardDataset>();
const indexes = new Map<string, CardIndex>();

function read<T>(dir: URL, file: string): T {
  const at = new URL(file, dir);
  try {
    return JSON.parse(readFileSync(at, "utf8")) as T;
  } catch (cause) {
    throw new Error(
      `could not read ${file} from ${dir.pathname} — run \`pnpm --filter jobs build-card-data\``,
      { cause },
    );
  }
}

/**
 * The three files under `data/cards/`, parsed.
 *
 * Memoized per directory: the default call is the same 2.4 MB every time, and
 * parsing it per request is the kind of cost that never shows up in one trace
 * and shows up in all of them.
 *
 * `dir` exists for tests and for a job pointing at a freshly built artifact. A
 * caller in the app passes nothing.
 */
export function loadCardDataset(dir: URL = DEFAULT_DIR): CardDataset {
  const key = dir.href;
  const cached = datasets.get(key);
  if (cached !== undefined) return cached;

  const dataset: CardDataset = {
    oracle: read<OracleCard[]>(dir, "oracle.json"),
    printings: read<CardPrinting[]>(dir, "printings.json"),
    meta: read<CardDatasetMeta>(dir, "meta.json"),
  };

  assertComplete(dataset, dir);
  datasets.set(key, dataset);
  return dataset;
}

/**
 * The dataset, turned into the lookup maps, once per process.
 *
 * Building the index is the expensive half — three maps over 1,826 cards and
 * 2,916 printings — so memoizing the dataset without memoizing this would leave
 * most of the cost in place.
 */
export function loadCardIndex(dir: URL = DEFAULT_DIR): CardIndex {
  const key = dir.href;
  const cached = indexes.get(key);
  if (cached !== undefined) return cached;

  const index = buildCardIndex(loadCardDataset(dir));
  indexes.set(key, index);
  return index;
}

/**
 * Refuse a dataset whose files disagree with each other.
 *
 * `meta.json` records what the build produced, so the counts are a checksum over
 * the other two files: a truncated write, a half-finished merge, or one file
 * updated without the others all show up here. Without this the failure is a
 * card that resolves on one machine and not another, days later.
 */
function assertComplete(dataset: CardDataset, dir: URL): void {
  const problems: string[] = [];
  if (dataset.oracle.length !== dataset.meta.oracleCardCount) {
    problems.push(
      `oracle.json has ${dataset.oracle.length} cards, meta.json says ${dataset.meta.oracleCardCount}`,
    );
  }
  if (dataset.printings.length !== dataset.meta.printingCount) {
    problems.push(
      `printings.json has ${dataset.printings.length} printings, meta.json says ${dataset.meta.printingCount}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `the card dataset at ${dir.pathname} is inconsistent: ${problems.join("; ")} — ` +
        "rebuild it with `pnpm --filter jobs build-card-data`",
    );
  }
}
