import type { FormatVersionId, RunStructure } from "@ps/contracts";

/** The bounds `tournament_runs` enforces (0048), checked first so the form can say why. */
export const MAX_SWISS_ROUNDS = 20;
export const MAX_TOP_CUT = 512;
export const RUN_NAME_MAX_LENGTH = 120;

export interface RunDetailsInput extends RunStructure {
  readonly name: string;
  readonly formatVersionIds: readonly FormatVersionId[];
}

export type RunDetailsProblem =
  "name-empty" | "name-long" | "no-format" | "swiss-rounds" | "top-cut" | "nothing-to-play";

/**
 * What an organizer typed for a run is usable (E26.16). Any structure is the
 * organizer's call (§28); the only one refused is no Swiss rounds and no cut, which
 * would be a run with nothing to play.
 */
export function checkRunDetails(input: RunDetailsInput): RunDetailsProblem | null {
  const name = input.name.trim();
  if (name === "") return "name-empty";
  if (name.length > RUN_NAME_MAX_LENGTH) return "name-long";
  if (input.formatVersionIds.length === 0) return "no-format";
  if (
    !Number.isInteger(input.swissRounds) ||
    input.swissRounds < 0 ||
    input.swissRounds > MAX_SWISS_ROUNDS
  ) {
    return "swiss-rounds";
  }
  if (!Number.isInteger(input.topCut) || input.topCut < 0 || input.topCut > MAX_TOP_CUT) {
    return "top-cut";
  }
  if (input.swissRounds === 0 && input.topCut < 2) return "nothing-to-play";
  return null;
}
