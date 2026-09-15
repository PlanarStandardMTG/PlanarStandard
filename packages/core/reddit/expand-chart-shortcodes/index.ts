/**
 * `:::chart{id="meta-share" title="Metagame share"}` embeds a live chart on the
 * site. Reddit has no way to run one, so it becomes a link to the chart plus a
 * link to a rendered PNG — the reader gets the picture without leaving the post,
 * and the interactive version is one click away.
 */
const SHORTCODE = /^[ \t]*:::chart\{([^}]*)\}[ \t]*$/gm;
const ATTRIBUTE = /(\w+)\s*=\s*"([^"]*)"/g;

export function expandChartShortcodes(markdown: string, canonicalUrl: string): string {
  const origin = originOf(canonicalUrl);

  return markdown.replace(SHORTCODE, (match, attributes: string) => {
    const parsed = parseAttributes(attributes);
    const id = parsed["id"];
    if (id === undefined || id.length === 0) return match;

    const title = parsed["title"] ?? id;
    const chartUrl = `${origin}/charts/${id}`;
    return `[${title}](${chartUrl}) — [PNG](${chartUrl}.png)`;
  });
}

function parseAttributes(attributes: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of attributes.matchAll(ATTRIBUTE)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) out[key] = value;
  }
  return out;
}

/** Parsed by hand rather than with `URL`: core compiles against no DOM and no node lib. */
function originOf(canonicalUrl: string): string {
  const withScheme = /^https?:\/\//i.test(canonicalUrl) ? canonicalUrl : `https://${canonicalUrl}`;
  return /^(https?:\/\/[^/?#]+)/i.exec(withScheme)?.[1] ?? "";
}
