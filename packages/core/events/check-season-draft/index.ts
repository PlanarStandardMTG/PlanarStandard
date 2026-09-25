import type { IsoDate, SeasonDraft } from "@ps/contracts";

import { isIsoDate } from "../../legality/check-format-draft/index";

/**
 * Whether what an admin typed is a season that can be saved (E20.35).
 *
 * Seasons may not overlap: an event's season is found from its date
 * (`findSeasonForDate`), and two seasons holding one date would make that a
 * guess. An open-ended season runs forever, so it overlaps everything after its
 * start. Problems are codes; the page words them.
 */
export const SEASON_NAME_MAX = 60;

export interface SeasonDraftInput {
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
}

/** Every other season, which this one must not overlap. */
export interface SeasonSpan {
  readonly name: string;
  readonly startsOn: IsoDate;
  readonly endsOn: IsoDate | null;
}

export type SeasonDraftProblem =
  | { readonly field: "name"; readonly code: "empty" | "long" }
  | { readonly field: "startsOn"; readonly code: "invalid" }
  | { readonly field: "endsOn"; readonly code: "invalid" | "before-start" }
  | { readonly field: "startsOn"; readonly code: "overlap"; readonly season: string };

export type SeasonDraftCheck =
  | { readonly ok: true; readonly value: SeasonDraft }
  | { readonly ok: false; readonly problems: readonly SeasonDraftProblem[] };

export function checkSeasonDraft(
  input: SeasonDraftInput,
  others: readonly SeasonSpan[],
): SeasonDraftCheck {
  const problems: SeasonDraftProblem[] = [];
  const name = input.name.trim();
  if (name === "") problems.push({ field: "name", code: "empty" });
  else if (name.length > SEASON_NAME_MAX) problems.push({ field: "name", code: "long" });

  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn.trim();
  if (!isIsoDate(startsOn)) problems.push({ field: "startsOn", code: "invalid" });
  if (endsOn !== "" && !isIsoDate(endsOn)) problems.push({ field: "endsOn", code: "invalid" });
  else if (endsOn !== "" && isIsoDate(startsOn) && endsOn < startsOn) {
    problems.push({ field: "endsOn", code: "before-start" });
  }

  if (problems.length > 0) return { ok: false, problems };

  const span = {
    startsOn: startsOn as IsoDate,
    endsOn: endsOn === "" ? null : (endsOn as IsoDate),
  };
  for (const other of others) {
    if (overlaps(span, other))
      problems.push({ field: "startsOn", code: "overlap", season: other.name });
  }
  if (problems.length > 0) return { ok: false, problems };

  return { ok: true, value: { name, ...span, isCurrent: input.isCurrent } };
}

function overlaps(
  a: { readonly startsOn: IsoDate; readonly endsOn: IsoDate | null },
  b: { readonly startsOn: IsoDate; readonly endsOn: IsoDate | null },
): boolean {
  return (
    (b.endsOn === null || a.startsOn <= b.endsOn) && (a.endsOn === null || b.startsOn <= a.endsOn)
  );
}
