/**
 * The one line an article uses to place a component (E20.23):
 *
 *     :::decklist{id="3f2a…" title="Rakdos Midrange"}
 *
 * Alone on its line, attributes double-quoted. It is the shape `:::chart{…}`
 * already had (`reddit/expand-chart-shortcodes`), so a post stays plain
 * Markdown (ADR 001) that any Markdown tool shows as a readable line.
 *
 * A call marked `inline="true"` may instead sit inside a sentence (E20.58):
 * `Cast :::card{name="Opt" inline="true"} first.`
 *
 * Lines inside a fenced code block, and inline code spans, are text, not
 * components, so a post can show the syntax without invoking it.
 */
export interface EmbedCall {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** The call as written, trimmed. Identifies this call within its post. */
  readonly source: string;
  /** Marked `inline="true"`: placed within a sentence rather than as a block. */
  readonly inline: boolean;
}

const LINE = /^[ \t]*:::([a-z][a-z0-9-]*)\{([^}\n]*)\}[ \t]*$/;
// A code span first, so a call written inside one is skipped whole.
const IN_TEXT = /(`+).*?\1|:::([a-z][a-z0-9-]*)\{([^}\n]*)\}/g;
const ATTRIBUTE = /([a-zA-Z][\w-]*)\s*=\s*"([^"\n]*)"/g;
const FENCE = /^[ \t]*(```|~~~)/;

function toCall(name: string, attributeText: string, source: string): EmbedCall {
  const attributes: Record<string, string> = {};
  for (const pair of attributeText.matchAll(ATTRIBUTE)) {
    if (pair[1] !== undefined && pair[2] !== undefined) attributes[pair[1]] = pair[2];
  }
  return { name, attributes, source, inline: attributes["inline"] === "true" };
}

/** One line, or null when it is not a component. */
export function parseEmbedLine(line: string): EmbedCall | null {
  const match = LINE.exec(line);
  return match === null ? null : toCall(match[1] ?? "", match[2] ?? "", line.trim());
}

/** Rewrite each inline call within a line of text. */
function replaceInline(line: string, replace: (call: EmbedCall) => string | null): string {
  return line.replace(
    IN_TEXT,
    (written, ticks: string | undefined, name?: string, attributes?: string) => {
      if (ticks !== undefined || name === undefined) return written;
      const call = toCall(name, attributes ?? "", written);
      return call.inline ? (replace(call) ?? written) : written;
    },
  );
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

/** Rewrite each component, block or inline; `null` leaves it exactly as written. */
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
      if (call !== null && !call.inline) return replace(call) ?? line;
      return replaceInline(line, replace);
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
