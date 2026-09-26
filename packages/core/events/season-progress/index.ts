import type { IsoDate, Season } from "@ps/contracts";

export interface SeasonProgress {
  /** 1 in the season's first month, and never past `months`. */
  readonly month: number;
  /** Null for a season with no end date yet. */
  readonly months: number | null;
}

/** Which month of a season `now` falls in; null before it opens or after it ends. */
export function seasonProgress(
  season: Pick<Season, "startsOn" | "endsOn">,
  now: Date,
): SeasonProgress | null {
  const today = now.toISOString().slice(0, 10);
  if (today < season.startsOn || (season.endsOn !== null && today > season.endsOn)) return null;

  return {
    month: wholeMonths(season.startsOn, today) + 1,
    months: season.endsOn === null ? null : wholeMonths(season.startsOn, season.endsOn) + 1,
  };
}

/** Whole calendar months from `from` to `to`: 1 March to 31 March is 0, to 1 April is 1. */
function wholeMonths(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}
