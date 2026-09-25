import { replaceEmbeds } from "@ps/core";

/** The fenced-code language a component line is carried in through the Markdown parser. */
export const EMBED_LANGUAGE = "ps-embed";

/**
 * Turn each component line into a fenced block for `PostBody` to pick out.
 *
 * A fence, rather than a remark plugin reading paragraphs, because a fence
 * keeps the line byte for byte: attribute values with `_` or `*` in them would
 * otherwise come out of the parser as emphasis. Lines already inside a fence
 * are skipped by `replaceEmbeds`, so a post can still show the syntax.
 */
export function prepareEmbeds(markdown: string): string {
  return replaceEmbeds(markdown, (call) => `\`\`\`${EMBED_LANGUAGE}\n${call.source}\n\`\`\``);
}
