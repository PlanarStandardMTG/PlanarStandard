import type {
  Archetype,
  ArchetypeId,
  ArchetypeSupertype,
  ArchetypeWithAliases,
  Color,
} from "@ps/contracts";

/**
 * The `archetypes` rows as PostgREST returns them, with the alias join. Kept
 * next to the mappers: outside this module an archetype is an `Archetype`, and
 * the snake_case shape of the tables is nobody else's business.
 */
export interface ArchetypeRow {
  readonly id: string;
  readonly name: string;
  readonly supertype: ArchetypeSupertype;
  readonly color_identity: readonly string[] | null;
  readonly description_markdown: string | null;
  readonly parent_id: string | null;
  readonly is_active: boolean;
  readonly aliases: readonly { readonly alias: string }[] | null;
}

export const ARCHETYPE_BASE_COLUMNS =
  "id, name, supertype, color_identity, description_markdown, parent_id, is_active";

export const ARCHETYPE_COLUMNS = `${ARCHETYPE_BASE_COLUMNS}, aliases:archetype_aliases (alias)`;

export function toArchetype(row: ArchetypeRow): Archetype {
  return {
    id: row.id as ArchetypeId,
    name: row.name,
    // `text[]`, not an enum: the column predates any constraint and a stray
    // value would be a data problem, not a reason to fail the read.
    colorIdentity: (row.color_identity ?? []) as readonly Color[],
    supertype: row.supertype,
    descriptionMarkdown: row.description_markdown,
    parentId: row.parent_id as ArchetypeId | null,
    isActive: row.is_active,
  };
}

export function toArchetypeWithAliases(row: ArchetypeRow): ArchetypeWithAliases {
  const aliases = (row.aliases ?? []).map((a) => a.alias);
  aliases.sort((a, b) => a.localeCompare(b));
  return { ...toArchetype(row), aliases };
}

/**
 * The TypeScript half of `archetype_aliases.normalized`.
 *
 * That column is `lower(regexp_replace(alias, '[^a-z0-9]', '', 'gi'))`, computed
 * by Postgres on write. Looking an alias up means producing the same string on
 * this side, and the two drifting apart would not fail — it would silently stop
 * matching, which is how a whole season's decks end up unlabelled.
 *
 * So `generated-columns.test.ts` asserts this function against the column, the
 * same way it already does for `core/identity/normalize-handle`. It is duplicated
 * rather than imported because `db` depends on contracts only, and the alternative
 * — pulling every alias in the table to match one string in memory — is a worse
 * trade than three lines and a parity test.
 */
export function normalizeAlias(alias: string): string {
  // Strip then lower, in that order, mirroring the SQL exactly. The two orders
  // happen to agree because the `i` flag keeps A-Z through the strip, but
  // matching the column literally is what makes that checkable by eye.
  return alias.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
