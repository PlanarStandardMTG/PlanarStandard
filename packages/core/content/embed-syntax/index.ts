/**
 * The one line an article uses to place a component (E20.23):
 *
 *     :::decklist{id="3f2a…" title="Rakdos Midrange"}
 *
 * Alone on its line, attributes double-quoted. It is the shape `:::chart{…}`
 * already had (`reddit/expand-chart-shortcodes`), so a post stays plain
 * Markdown (ADR 001) that any Markdown tool shows as a readable line.
 *
 * Lines inside a fenced code block are text, not components, so a post can
 * show the syntax without invoking it.
 */
export interface EmbedCall {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** The line as written, trimmed. Identifies this call within its post. */
  readonly source: string;
}

const LINE = /^[ \t]*:::([a-z][a-z0-9-]*)\{([^}\n]*)\}[ \t]*$/;
const ATTRIBUTE = /([a-zA-Z][\w-]*)\s*=\s*"([^"\n]*)"/g;
const FENCE = /^[ \t]*(```|~~~)/;

/** One line, or null when it is not a component. */
export function parseEmbedLine(line: string): EmbedCall | null {
  const match = LINE.exec(line);
  if (match === null) return null;

  const attributes: Record<string, string> = {};
  for (const pair of (match[2] ?? "").matchAll(ATTRIBUTE)) {
    if (pair[1] !== undefined && pair[2] !== undefined) attributes[pair[1]] = pair[2];
  }
  return { name: match[1] ?? "", attributes, source: line.trim() };
}

/** Every component a post places, in order, skipping fenced code. */
export function findEmbeds(markdown: string): readonly EmbedCall[] {
  const calls: EmbedCall[] = [];
  replaceEmbeds(markdown, (call) => {
    calls.push(call);
    return null;
  });
  return calls;
}

/** Rewrite each component line; `null` leaves the line exactly as written. */
export function replaceEmbeds(
  markdown: string,
  replace: (call: EmbedCall) => string | null,
): string {
  let fence: string | null = null;

  return markdown
    .split("\n")
    .map((line) => {
      const opener = FENCE.exec(line)?.[1];
      if (opener !== undefined) {
        if (fence === null) fence = opener;
        else if (opener === fence) fence = null;
        return line;
      }
      if (fence !== null) return line;

      const call = parseEmbedLine(line);
      return call === null ? line : (replace(call) ?? line);
    })
    .join("\n");
}

/** The line for a component, as the editor inserts it. Quotes cannot be escaped, so they are dropped. */
export function formatEmbed(name: string, attributes: Readonly<Record<string, string>>): string {
  const pairs = Object.entries(attributes).map(
    ([key, value]) => `${key}="${value.replaceAll('"', "").replaceAll("\n", " ")}"`,
  );
  return `:::${name}{${pairs.join(" ")}}`;
}
