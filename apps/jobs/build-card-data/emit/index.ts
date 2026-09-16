import type {
  CardDataset,
  CardDatasetMeta,
  IsoDateTime,
  SetCode,
} from "@ps/contracts";

import { SCRYFALL_ATTRIBUTION } from "../bulk-index/index";
import type { PruneResult } from "../prune/index";

export type EmitInput = {
  /** `updated_at` of the bulk file, recorded as the dataset's provenance. */
  readonly bulkUpdatedAt: IsoDateTime;
  /** `data/sets.json` as validated — the fetch scope, not the legal pool. */
  readonly scope: readonly SetCode[];
  readonly generatedAt: IsoDateTime;
};

/** The three files, as the exact bytes to write. */
export type EmittedFiles = {
  readonly "oracle.json": string;
  readonly "printings.json": string;
  readonly "meta.json": string;
};

export function buildDataset(
  result: PruneResult,
  input: EmitInput,
): CardDataset {
  const meta: CardDatasetMeta = {
    bulkUpdatedAt: input.bulkUpdatedAt,
    setCodes: [...input.scope],
    oracleCardCount: result.oracle.length,
    printingCount: result.printings.length,
    printingCountBySet: sortKeys(result.printingCountBySet),
    generatedAt: input.generatedAt,
    attribution: SCRYFALL_ATTRIBUTION,
  };

  return { oracle: result.oracle, printings: result.printings, meta };
}

/**
 * Two-space JSON with a trailing newline — a readable diff matters more here than
 * bytes, because a set release lands as a pull request someone reviews (§14.1).
 *
 * `oracle.json` and `printings.json` are byte-stable for unchanged input; `meta.json`
 * is not, because `generatedAt` moves every run. E4.5 gates its PR on the two data
 * files for exactly that reason.
 */
export function serialize(dataset: CardDataset): EmittedFiles {
  return {
    "oracle.json": stringify(dataset.oracle),
    "printings.json": stringify(dataset.printings),
    "meta.json": stringify(dataset.meta),
  };
}

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortKeys(
  counts: Readonly<Record<SetCode, number>>,
): Readonly<Record<SetCode, number>> {
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}
