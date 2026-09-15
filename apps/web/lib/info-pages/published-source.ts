/**
 * Some info pages publish a module doc verbatim. `/methodology` is the standing
 * example: §19 and Part VIII both require that a metric definition and the page
 * describing it cannot drift, so the page does not restate the doc — it embeds
 * a region derived from it, and a test fails when the two disagree.
 *
 * Markers, not heuristics:
 *   docs/*.md   `<!-- publish:start -->` … `<!-- publish:end -->` bounds the
 *               publishable region; `<!-- publish:omit -->` drops the block that
 *               follows it, for notes that are about the file rather than the
 *               format.
 *   *.mdx       `{/* generated:start <source> *\/}` … `{/* generated:end *\/}`
 *               bounds where that region lands. MDX has no HTML comments, hence
 *               the two spellings.
 */

const PUBLISH_START = "<!-- publish:start -->";
const PUBLISH_END = "<!-- publish:end -->";
const PUBLISH_OMIT = "<!-- publish:omit -->";

const GENERATED_START = /^\{\/\* generated:start (\S+) \*\/\}$/;
const GENERATED_END = "{/* generated:end */}";

export class ContentSyncError extends Error {}

/** The publishable region of a module doc, with omitted blocks removed. */
export function publishedBody(markdown: string): string {
  const start = markdown.indexOf(PUBLISH_START);
  const end = markdown.indexOf(PUBLISH_END);
  if (start === -1 || end === -1) {
    throw new ContentSyncError(`missing ${PUBLISH_START} / ${PUBLISH_END} markers`);
  }
  if (end < start) {
    throw new ContentSyncError(`${PUBLISH_END} appears before ${PUBLISH_START}`);
  }

  const region = markdown.slice(start + PUBLISH_START.length, end);
  const kept: string[] = [];
  let omitting = false;
  for (const line of region.split("\n")) {
    if (line.trim() === PUBLISH_OMIT) {
      omitting = true;
      continue;
    }
    if (omitting) {
      if (line.trim() === "") omitting = false;
      continue;
    }
    kept.push(line);
  }

  return kept.join("\n").trim();
}

export interface GeneratedRegion {
  readonly source: string;
  readonly body: string;
}

/** The generated region of an MDX page, or null when the page has none. */
export function readGeneratedRegion(mdx: string): GeneratedRegion | null {
  const lines = mdx.split("\n");
  const startIndex = lines.findIndex((line) => GENERATED_START.test(line.trim()));
  if (startIndex === -1) return null;
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === GENERATED_END);
  if (endIndex === -1) throw new ContentSyncError(`missing ${GENERATED_END}`);

  const source = GENERATED_START.exec(lines[startIndex]?.trim() ?? "")?.[1];
  if (source === undefined) throw new ContentSyncError("generated:start has no source path");

  return { source, body: lines.slice(startIndex + 1, endIndex).join("\n").trim() };
}

/** The same page with its generated region replaced. Everything outside it is untouched. */
export function writeGeneratedRegion(mdx: string, body: string): string {
  const lines = mdx.split("\n");
  const startIndex = lines.findIndex((line) => GENERATED_START.test(line.trim()));
  if (startIndex === -1) throw new ContentSyncError("page has no generated region");
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === GENERATED_END);
  if (endIndex === -1) throw new ContentSyncError(`missing ${GENERATED_END}`);

  return [...lines.slice(0, startIndex + 1), "", body, "", ...lines.slice(endIndex)].join("\n");
}
