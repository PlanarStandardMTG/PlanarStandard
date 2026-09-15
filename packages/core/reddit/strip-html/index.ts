/**
 * Reddit drops raw HTML in self-posts, so an article that used a little inline
 * markup would silently lose it. Unwrap the tags and keep the text.
 */

/** Block-level tags leave a paragraph break behind; inline tags leave nothing. */
const BLOCK_TAGS = /<\/?(?:p|div|section|article|br|hr|h[1-6]|li|ul|ol|table|tr|blockquote)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][a-z0-9-]*\b[^>]*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
];

export function stripHtml(markdown: string): string {
  let text = markdown.replace(HTML_COMMENT, "");
  text = text.replace(BLOCK_TAGS, "\n");
  text = text.replace(ANY_TAG, "");
  for (const [pattern, replacement] of ENTITIES) text = text.replace(pattern, replacement);
  // Unwrapping a block tag leaves a blank line behind; collapse the run, and
  // drop the gap a leading comment or wrapper div left at the top.
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "");
}
