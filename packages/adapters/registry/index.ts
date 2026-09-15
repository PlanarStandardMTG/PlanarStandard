// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.1 — which adapter reads this upload.

import type { AdapterDetection, AdapterId, RawInput, ResultsAdapter } from "@ps/contracts";

import { archetypeMapHtml } from "../archetype-map-html/index";
import { genericCsv } from "../generic-csv/index";
import { manualEntry } from "../manual-entry/index";

export interface RegisteredAdapter {
  readonly adapter: ResultsAdapter;
  /**
   * A floor, consulted only when no specific adapter claims the input.
   * `generic-csv` reads any delimited file, so without this it would be
   * ambiguous with every CSV source in the table.
   */
  readonly fallback?: boolean;
}

/** Every adapter the site ships, most specific first (§9). */
export const defaultRegistry: readonly RegisteredAdapter[] = [
  { adapter: manualEntry },
  { adapter: archetypeMapHtml },
  { adapter: genericCsv, fallback: true },
];

/**
 * Run every `detect` and report the outcome.
 *
 * Two adapters claiming one file is an outcome the operator resolves, never
 * something registration order decides quietly: the wrong adapter on a melee
 * export produces plausible pairings that are not the ones that were played.
 */
export function detectAdapter(
  input: RawInput,
  registry: readonly RegisteredAdapter[] = defaultRegistry,
): AdapterDetection {
  const specific = claimants(
    input,
    registry.filter((entry) => entry.fallback !== true),
  );
  if (specific.length === 1) return { outcome: "matched", adapter: specific[0] as ResultsAdapter };
  if (specific.length > 1) return ambiguous(input, specific);

  const fallbacks = claimants(
    input,
    registry.filter((entry) => entry.fallback === true),
  );
  if (fallbacks.length === 1)
    return { outcome: "matched", adapter: fallbacks[0] as ResultsAdapter };
  if (fallbacks.length > 1) return ambiguous(input, fallbacks);

  return {
    outcome: "unrecognized",
    issue: {
      code: "unrecognized-format",
      severity: "error",
      message:
        `No adapter recognised ${input.fileName || "this upload"}. ` +
        `Export it as CSV and map the columns by hand, or enter the pairings directly. ` +
        `Adapters tried: ${registry.map((entry) => entry.adapter.id).join(", ")}.`,
    },
  };
}

/** The adapter with this id, for a re-import that already recorded one (§26). */
export function adapterById(
  id: AdapterId,
  registry: readonly RegisteredAdapter[] = defaultRegistry,
): ResultsAdapter | null {
  return registry.find((entry) => entry.adapter.id === id)?.adapter ?? null;
}

function claimants(
  input: RawInput,
  registry: readonly RegisteredAdapter[],
): readonly ResultsAdapter[] {
  return registry
    .filter((entry) => detectSafely(entry.adapter, input))
    .map((entry) => entry.adapter);
}

/** A `detect` that throws is a broken adapter, not a broken upload. */
function detectSafely(adapter: ResultsAdapter, input: RawInput): boolean {
  try {
    return adapter.detect(input);
  } catch {
    return false;
  }
}

function ambiguous(input: RawInput, candidates: readonly ResultsAdapter[]): AdapterDetection {
  return {
    outcome: "ambiguous",
    candidates,
    issue: {
      code: "ambiguous-format",
      severity: "error",
      message:
        `${candidates.length} adapters claim ${input.fileName || "this upload"}: ` +
        `${candidates.map((adapter) => adapter.id).join(", ")}. Choose one.`,
    },
  };
}
