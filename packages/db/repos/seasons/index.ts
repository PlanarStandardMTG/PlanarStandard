import type { FormatVersionId, IsoDate, Season, SeasonDraft, SeasonId } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads and writes over `seasons`: which one the site is in, which one an event
 * belongs to, and an admin's edits (E20.35). Reads are public; writes take the
 * admin's own client, so `seasons_admin_write` decides.
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

/** Every season, newest first. */
export async function listSeasons(client: SupabaseClient): Promise<readonly Season[]> {
  const { data, error } = await client
    .from("seasons")
    .select(SEASON_COLUMNS)
    .order("ordinal", { ascending: false });

  if (error !== null) throw new Error(`listSeasons failed: ${error.message}`);
  return (data as unknown as SeasonRow[]).map(toSeason);
}

export async function getSeason(client: SupabaseClient, id: SeasonId): Promise<Season | null> {
  const { data, error } = await client
    .from("seasons")
    .select(SEASON_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error !== null) throw new Error(`getSeason failed: ${error.message}`);
  return data === null ? null : toSeason(data as unknown as SeasonRow);
}

/**
 * Create a season (`id` null) or edit one, and bring its tournaments with it.
 *
 * A new season is numbered after the last. Marking one current un-marks the old
 * one first, because `seasons_one_current` allows one; that leaves a moment with
 * none, which costs a reader an empty ladder and nothing else.
 *
 * An event's season follows its date (`findSeasonForDate`), so saving a season
 * re-files the tournaments: every one dated inside it joins it, and any of its
 * own now dated outside it leaves. Not atomic — PostgREST has no transaction —
 * and saving again finishes the job.
 */
export async function saveSeason(
  client: SupabaseClient,
  id: SeasonId | null,
  draft: SeasonDraft,
): Promise<SeasonId> {
  if (draft.isCurrent) {
    let others = client.from("seasons").update({ is_current: false }).eq("is_current", true);
    if (id !== null) others = others.neq("id", id);
    const { error } = await others;
    if (error !== null)
      throw new Error(`saveSeason failed un-marking the current season: ${error.message}`);
  }

  const fields = {
    name: draft.name,
    starts_on: draft.startsOn,
    ends_on: draft.endsOn,
    is_current: draft.isCurrent,
  };
  const { data, error } =
    id === null
      ? await client
          .from("seasons")
          .insert({ ...fields, ordinal: (await lastOrdinal(client)) + 1 })
          .select("id")
          .single()
      : await client.from("seasons").update(fields).eq("id", id).select("id").single();
  if (error !== null) throw new Error(`saveSeason failed: ${error.message}`);
  const saved = (data as { id: string }).id as SeasonId;

  let leaving = client.from("tournaments").update({ season_id: null }).eq("season_id", saved);
  leaving =
    draft.endsOn === null
      ? leaving.lt("event_date", draft.startsOn)
      : leaving.or(`event_date.lt.${draft.startsOn},event_date.gt.${draft.endsOn}`);
  const { error: leaveError } = await leaving;
  if (leaveError !== null)
    throw new Error(`saveSeason failed re-filing tournaments: ${leaveError.message}`);

  let joining = client
    .from("tournaments")
    .update({ season_id: saved })
    .gte("event_date", draft.startsOn);
  if (draft.endsOn !== null) joining = joining.lte("event_date", draft.endsOn);
  const { error: joinError } = await joining;
  if (joinError !== null)
    throw new Error(`saveSeason failed re-filing tournaments: ${joinError.message}`);

  return saved;
}

async function lastOrdinal(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from("seasons")
    .select("ordinal")
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) throw new Error(`saveSeason failed numbering the season: ${error.message}`);
  return (data as { ordinal: number } | null)?.ordinal ?? 0;
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
