import type { Season } from "@ps/contracts";

export interface SeasonProgress {
  /** 1 on the opening day, and never past `weeks`. */
  readonly week: number;
  /** Null for a season with no end date yet. */
  readonly weeks: number | null;
}

const DAY = 86_400_000;

/** Which week of a season `now` falls in; null before it opens or after it ends. */
export function seasonProgress(
  season: Pick<Season, "startsOn" | "endsOn">,
  now: Date,
): SeasonProgress | null {
  const start = Date.parse(`${season.startsOn}T00:00:00Z`);
  const end = season.endsOn === null ? null : Date.parse(`${season.endsOn}T00:00:00Z`) + DAY;
  const time = now.getTime();
  if (time < start || (end !== null && time >= end)) return null;

  const weeks = end === null ? null : Math.ceil((end - start) / (7 * DAY));
  return { week: Math.floor((time - start) / (7 * DAY)) + 1, weeks };
}
