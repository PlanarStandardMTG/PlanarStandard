import type { Archetype, ArchetypeId, ArchetypeWithAliases } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ARCHETYPE_BASE_COLUMNS,
  ARCHETYPE_COLUMNS,
  normalizeAlias,
  toArchetype,
  toArchetypeWithAliases,
  type ArchetypeRow,
} from "./rows";

/**
 * Reads over `archetypes` and `archetype_aliases` (E13.23).
 *
 * The vocabulary the metagame is described in. All public: the metagame is the
 * site's whole subject, and the words it is reported in are not a secret. Admin
 * writes are E14.4 and the editor is E20.18.
 */

/**
 * The whole vocabulary, with aliases, ordered by name.
 *
 * Small on purpose — five rows today, a few dozen at worst — so a caller that
 * needs to resolve many labels at once should take this and match in memory
 * rather than calling `findArchetypeByAlias` in a loop.
 */
export async function listArchetypes(
  client: SupabaseClient,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<readonly ArchetypeWithAliases[]> {
  const query = client.from("archetypes").select(ARCHETYPE_COLUMNS).order("name");
  const { data, error } = await (includeInactive ? query : query.eq("is_active", true));

  if (error !== null) throw new Error(`listArchetypes failed: ${error.message}`);
  return (data as unknown as ArchetypeRow[]).map(toArchetypeWithAliases);
}

/** One archetype by id. Null when the id is unknown. */
export async function getArchetype(
  client: SupabaseClient,
  archetypeId: ArchetypeId,
): Promise<ArchetypeWithAliases | null> {
  const { data, error } = await client
    .from("archetypes")
    .select(ARCHETYPE_COLUMNS)
    .eq("id", archetypeId)
    .maybeSingle();

  if (error !== null) throw new Error(`getArchetype failed: ${error.message}`);
  return data === null ? null : toArchetypeWithAliases(data as unknown as ArchetypeRow);
}

/**
 * The archetype a source's own label means, or null if nobody has taught the
 * site that spelling yet.
 *
 * This is the query the alias table exists for. An adapter reports
 * `archetypeRaw` exactly as printed — `4c Dragons (Midrange)` — and never
 * resolves it (E12.7); this resolves it against the generated `normalized`
 * column, so punctuation, spacing and case are all irrelevant.
 *
 * An archetype's own name is tried too, because it is obviously a spelling of
 * itself and the vocabulary does not register it as an alias. That fallback is
 * only case-insensitive, not punctuation-insensitive: `archetypes.name` has no
 * normalized column to match against. Registering a punctuated form as a real
 * alias is the fix when a source needs one, which is what the alias table is for.
 *
 * **Null is a normal answer, not an error.** An unrecognised label means the deck
 * keeps its `archetype_raw` and gets no `archetype_id` until somebody adds the
 * alias — at which point re-resolving fixes every deck that ever carried it.
 * Guessing here would put a wrong archetype into the metagame numbers, which is
 * the one thing worse than a missing one.
 */
export async function findArchetypeByAlias(
  client: SupabaseClient,
  label: string,
): Promise<Archetype | null> {
  const normalized = normalizeAlias(label);
  if (normalized === "") return null;

  const { data, error } = await client
    .from("archetype_aliases")
    .select(`archetype:archetypes!inner (${ARCHETYPE_BASE_COLUMNS})`)
    .eq("normalized", normalized)
    .maybeSingle();

  if (error !== null) throw new Error(`findArchetypeByAlias failed: ${error.message}`);

  const matched = (data as unknown as { archetype: ArchetypeRow | null } | null)?.archetype ?? null;
  return matched !== null ? toArchetype(matched) : await findArchetypeByName(client, label);
}

/**
 * `ilike` with no wildcards is an exact match that ignores case. The label is
 * escaped because `%` and `_` are pattern syntax, and an archetype called
 * "100%_Snow" would otherwise match far more than itself.
 */
async function findArchetypeByName(
  client: SupabaseClient,
  name: string,
): Promise<Archetype | null> {
  const { data, error } = await client
    .from("archetypes")
    .select(ARCHETYPE_BASE_COLUMNS)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();

  if (error !== null) throw new Error(`findArchetypeByAlias failed on name: ${error.message}`);
  return data === null ? null : toArchetype(data as unknown as ArchetypeRow);
}
