import type { EventPodium } from "@ps/contracts";

import { SAMPLE_PODIUM } from "./sample-podium";

/** How many finishers the home page shows. Four fills the row at every width. */
export const PODIUM_SIZE = 4;

export interface LatestPodium {
  readonly podium: EventPodium;
  /**
   * True while these are stand-in finishers rather than an imported result. The
   * section renders a label from this — see `sample-podium.ts` for why it is not
   * optional.
   */
  readonly sample: boolean;
}

/**
 * The top finishers of the most recent event that has results.
 *
 * This is the seam, and today it is the whole feature: the real version is one
 * repository read — the newest `tournaments` row whose status is
 * `results_imported` or `verified`, joined to its `tournament_entries` and their
 * decks — and none of those tables exist yet (E13.7, E13.8, E24.5).
 *
 * Deliberately shaped as the eventual read rather than as a constant: async,
 * returning `null` for "no event has results yet", and sliced to `PODIUM_SIZE`
 * here rather than in the component. When the query replaces the body, nothing
 * above this function changes — which is the point of writing it this way while
 * the answer is a literal.
 */
export async function loadLatestPodium(): Promise<LatestPodium | null> {
  const podium: EventPodium = {
    ...SAMPLE_PODIUM,
    finishes: SAMPLE_PODIUM.finishes.slice(0, PODIUM_SIZE),
  };

  return Promise.resolve({ podium, sample: true });
}
