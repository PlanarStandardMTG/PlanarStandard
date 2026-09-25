import type { FormatVersionId, IsoDate, Season, SeasonId } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads over `seasons`: which one the site is in, and which one an event
 * belongs to. Public reads — every season is readable.
 */

const SEASON_COLUMNS = "id, name, ordinal, starts_on, ends_on, format_version_id, is_current";

interface SeasonRow {
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly starts_on: string;
  readonly ends_on: string | null;
  readonly format_version_id: string | null;
  readonly is_current: boolean;
}

/** The season the leaderboard is scoped to. Null before an admin has opened one. */
export async function getCurrentSeason(client: SupabaseClient): Promise<Season | null> {
  const { data, error } = await client
    .from("seasons")
    .select(SEASON_COLUMNS)
    .eq("is_current", true)
    .maybeSingle();

  if (error !== null) throw new Error(`getCurrentSeason failed: ${error.message}`);
  return data === null ? null : toSeason(data as unknown as SeasonRow);
}

/**
 * The season an event played on `date` belongs to: the latest one that had
 * started by then and had not ended. Null for a date between seasons.
 */
export async function findSeasonForDate(
  client: SupabaseClient,
  date: IsoDate,
): Promise<Season | null> {
  const { data, error } = await client
    .from("seasons")
    .select(SEASON_COLUMNS)
    .lte("starts_on", date)
    .or(`ends_on.is.null,ends_on.gte.${date}`)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw new Error(`findSeasonForDate failed: ${error.message}`);
  return data === null ? null : toSeason(data as unknown as SeasonRow);
}

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id as SeasonId,
    name: row.name,
    ordinal: row.ordinal,
    startsOn: row.starts_on as IsoDate,
    endsOn: row.ends_on as IsoDate | null,
    formatVersionId: row.format_version_id as FormatVersionId | null,
    isCurrent: row.is_current,
  };
}
