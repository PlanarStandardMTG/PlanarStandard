import { replaceEmbeds } from "@ps/core";

/** The fenced-code language a component line is carried in through the Markdown parser. */
export const EMBED_LANGUAGE = "ps-embed";

/** The prefix an inline component is carried behind, in a code span. */
export const INLINE_EMBED_PREFIX = "ps-embed:";

/**
 * Turn each component line into a fenced block for `PostBody` to pick out,
 * and each inline one into a code span.
 *
 * Code, rather than a remark plugin reading paragraphs, because code keeps the
 * call byte for byte: attribute values with `_` or `*` in them would otherwise
 * come out of the parser as emphasis. Calls already inside code are skipped by
 * `replaceEmbeds`, so a post can still show the syntax. The span's double
 * backticks let a value hold a single one.
 */
export function prepareEmbeds(markdown: string): string {
  return replaceEmbeds(markdown, (call) =>
    call.inline
      ? `\`\` ${INLINE_EMBED_PREFIX}${call.source} \`\``
      : `\`\`\`${EMBED_LANGUAGE}\n${call.source}\n\`\`\``,
  );
}
