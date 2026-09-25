import type {
  DeckConstraints,
  FormatCardRule,
  FormatVersion,
  FormatVersionDetail,
  FormatVersionDraft,
  FormatVersionId,
  SetCode,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  toCardRule,
  toConstraints,
  toFormatVersion,
  type CardRuleRow,
  type ConstraintsRow,
  type FormatVersionRow,
} from "./rows";

/**
 * Reads over the four `format_*` tables.
 *
 * Format authority is data, not code: a B&R announcement changes rows an admin
 * edits and never requires a deploy (§14.1). These are the reads that make that
 * true — nothing on the site may hard-code a legal set or a ban.
 *
 * Flattening to `FormatRules` is `core/legality/resolve-format`'s job, which is
 * why this returns rows. `db` depends on contracts only.
 */

const VERSION_COLUMNS = "id, name, effective_from, effective_to, notes_markdown, is_current";

/** The version in force today. Null only if nobody has marked one current. */
export async function getCurrentFormatVersion(
  client: SupabaseClient,
): Promise<FormatVersion | null> {
  const { data, error } = await client
    .from("format_versions")
    .select(VERSION_COLUMNS)
    .eq("is_current", true)
    .maybeSingle();

  if (error !== null) throw new Error(`getCurrentFormatVersion failed: ${error.message}`);
  return data === null ? null : toFormatVersion(data as unknown as FormatVersionRow);
}

/** The current version with its pool, its rulings and its constraints — what `/rules` renders. */
export async function getCurrentFormatDetail(
  client: SupabaseClient,
): Promise<FormatVersionDetail | null> {
  const version = await getCurrentFormatVersion(client);
  return version === null ? null : await detailFor(client, version);
}

/**
 * One version by id. An event on a special pool validates against this rather
 * than against whatever is current, because "current" moves and the event did not.
 */
export async function getFormatDetail(
  client: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<FormatVersionDetail | null> {
  const { data, error } = await client
    .from("format_versions")
    .select(VERSION_COLUMNS)
    .eq("id", formatVersionId)
    .maybeSingle();

  if (error !== null) throw new Error(`getFormatDetail failed: ${error.message}`);
  return data === null
    ? null
    : await detailFor(client, toFormatVersion(data as unknown as FormatVersionRow));
}

/** Every version, current first, then newest first — the admin list (E20.33). */
export async function listFormatVersions(
  client: SupabaseClient,
): Promise<readonly FormatVersion[]> {
  const { data, error } = await client
    .from("format_versions")
    .select(VERSION_COLUMNS)
    .order("is_current", { ascending: false })
    .order("effective_from", { ascending: false });

  if (error !== null) throw new Error(`listFormatVersions failed: ${error.message}`);
  return (data as unknown as FormatVersionRow[]).map(toFormatVersion);
}

/**
 * Create a version (`formatVersionId` null) or replace one, with its sets,
 * constraints and card rules, in one transaction (E20.33). Making it current
 * un-marks the old current version. Takes the admin's own client:
 * `format_*_admin_write` decides.
 */
export async function saveFormatVersion(
  client: SupabaseClient,
  formatVersionId: FormatVersionId | null,
  draft: FormatVersionDraft,
): Promise<FormatVersionId> {
  const { data, error } = await client.rpc("save_format_version", {
    format_version_id: formatVersionId,
    draft: {
      name: draft.name,
      effective_from: draft.effectiveFrom,
      effective_to: draft.effectiveTo,
      notes_markdown: draft.notesMarkdown,
      is_current: draft.isCurrent,
      legal_sets: draft.legalSets,
      constraints: {
        min_maindeck: draft.constraints.minMaindeck,
        max_maindeck: draft.constraints.maxMaindeck,
        max_sideboard: draft.constraints.maxSideboard,
        max_copies: draft.constraints.maxCopies,
        singleton: draft.constraints.singleton,
      },
      card_rules: draft.cardRules.map((rule) => ({
        oracle_id: rule.oracleId,
        ruling: rule.ruling,
        reason: rule.reason,
        effective_from: rule.effectiveFrom,
      })),
    },
  });

  if (error !== null) throw new Error(`saveFormatVersion failed: ${error.message}`);
  return data as FormatVersionId;
}

/**
 * Why a version could not be deleted: it is the current one, or a season,
 * tournament or deck names it and would be left pointing at nothing.
 */
export type FormatVersionDeletion =
  { readonly ok: true } | { readonly ok: false; readonly reason: "current" | "in-use" };

/** Delete a version with its sets, constraints and card rules (E20.33). */
export async function deleteFormatVersion(
  client: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<FormatVersionDeletion> {
  const { error } = await client.rpc("delete_format_version", {
    format_version_id: formatVersionId,
  });

  if (error === null) return { ok: true };
  if (error.code === CHECK_VIOLATION) return { ok: false, reason: "current" };
  if (error.code === FOREIGN_KEY_VIOLATION) return { ok: false, reason: "in-use" };
  throw new Error(`deleteFormatVersion failed: ${error.message}`);
}

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

async function detailFor(
  client: SupabaseClient,
  version: FormatVersion,
): Promise<FormatVersionDetail> {
  const [legalSets, cardRules, constraints] = await Promise.all([
    listLegalSets(client, version.id),
    listCardRules(client, version.id),
    getConstraints(client, version.id),
  ]);

  return { version, legalSets, cardRules, constraints };
}

async function listLegalSets(
  client: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<readonly SetCode[]> {
  const { data, error } = await client
    .from("format_legal_sets")
    .select("set_code")
    .eq("format_version_id", formatVersionId)
    .order("set_code");

  if (error !== null) throw new Error(`listLegalSets failed: ${error.message}`);
  return (data ?? []).map((row) => (row as { set_code: string }).set_code as SetCode);
}

async function listCardRules(
  client: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<readonly FormatCardRule[]> {
  const { data, error } = await client
    .from("format_card_rules")
    .select("oracle_id, ruling, reason, effective_from")
    .eq("format_version_id", formatVersionId)
    .order("effective_from", { ascending: false, nullsFirst: false });

  if (error !== null) throw new Error(`listCardRules failed: ${error.message}`);
  return (data as unknown as CardRuleRow[]).map(toCardRule);
}

async function getConstraints(
  client: SupabaseClient,
  formatVersionId: FormatVersionId,
): Promise<DeckConstraints | null> {
  const { data, error } = await client
    .from("format_constraints")
    .select("min_maindeck, max_maindeck, max_sideboard, max_copies, singleton, extra_rules")
    .eq("format_version_id", formatVersionId)
    .maybeSingle();

  if (error !== null) throw new Error(`getConstraints failed: ${error.message}`);
  return data === null ? null : toConstraints(data as unknown as ConstraintsRow);
}
