import { replaceEmbeds } from "../embed-syntax/index";

/**
 * What a component has to say for itself to be placed in an article (E20.23).
 *
 * The site renders a component live (`web/components/content/embeds`). Every
 * other place a post goes gets Markdown instead, and `export` is where each
 * component says what that Markdown is. It is a `Record` over every target, so
 * a new component cannot compile without an answer for each, and a new target
 * cannot be added without every component answering it.
 */
export type ExportTarget = "reddit" | "discord";

export const EXPORT_TARGETS: readonly ExportTarget[] = ["reddit", "discord"];

export interface EmbedExportContext {
  /** The site origin, for links back — `https://planarstandard.com`. */
  readonly origin: string;
}

export interface EmbedAttribute {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export type EmbedParse<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly problem: string };

/**
 * One component. `A` is its attributes once parsed; `D` is whatever the site
 * loads to show it (a deck, an image's dimensions), handed to `export` too so
 * that a decklist can be written out as text. `D` is null when nothing was
 * loaded — the export must still produce something useful, usually a link.
 */
export interface EmbedDefinition<N extends string, A, D> {
  readonly name: N;
  readonly label: string;
  readonly description: string;
  readonly attributes: readonly EmbedAttribute[];
  parse(raw: Readonly<Record<string, string>>): EmbedParse<A>;
  readonly export: Readonly<
    Record<ExportTarget, (attributes: A, data: D | null, context: EmbedExportContext) => string>
  >;
}

/** A definition with its types erased, so different components share one list. */
export interface RegisteredEmbed<N extends string = string> {
  readonly name: N;
  readonly label: string;
  readonly description: string;
  readonly attributes: readonly EmbedAttribute[];
  /** Null when the attributes are acceptable, else what is wrong with them. */
  check(raw: Readonly<Record<string, string>>): string | null;
  /** Null when the attributes do not parse — the line is then left as written. */
  exportAs(
    target: ExportTarget,
    raw: Readonly<Record<string, string>>,
    data: unknown,
    context: EmbedExportContext,
  ): string | null;
}

export function defineEmbed<N extends string, A, D>(
  definition: EmbedDefinition<N, A, D>,
): RegisteredEmbed<N> {
  return {
    name: definition.name,
    label: definition.label,
    description: definition.description,
    attributes: definition.attributes,
    check(raw) {
      const parsed = definition.parse(raw);
      return parsed.ok ? null : parsed.problem;
    },
    exportAs(target, raw, data, context) {
      const parsed = definition.parse(raw);
      if (!parsed.ok) return null;
      // The one cast: `data` arrives keyed by the call's source line, from the
      // loader the site registers under this same name.
      return definition.export[target](parsed.value, (data ?? null) as D | null, context);
    },
  };
}

/** Loaded data per call, keyed by `EmbedCall.source`. */
export type EmbedData = ReadonlyMap<string, unknown>;

/**
 * Replace every registered component with its Markdown for `target`. Unknown
 * names and unparseable attributes are left as written — a typo should be
 * visible in the export, not silently dropped.
 */
export function expandEmbeds(
  markdown: string,
  target: ExportTarget,
  registry: readonly RegisteredEmbed[],
  context: EmbedExportContext,
  data: EmbedData = new Map(),
): string {
  const byName = new Map(registry.map((embed) => [embed.name, embed]));
  return replaceEmbeds(markdown, (call) => {
    const embed = byName.get(call.name);
    return embed === undefined
      ? null
      : embed.exportAs(target, call.attributes, data.get(call.source), context);
  });
}
