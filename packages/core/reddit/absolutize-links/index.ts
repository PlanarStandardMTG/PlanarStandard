/**
 * A root-relative link is dead on Reddit — there is no site to be relative to.
 * Resolve every one against the canonical origin.
 */
const ROOT_RELATIVE = /(\]\()(\/[^)\s]*)(\))/g;

export function absolutizeLinks(markdown: string, canonicalUrl: string): string {
  const origin = originOf(canonicalUrl);
  if (origin === null) return markdown;
  return markdown.replace(
    ROOT_RELATIVE,
    (_m, open: string, path: string, close: string) => `${open}${origin}${path}${close}`,
  );
}

/**
 * Tolerates a bare host, since the canonical url is configuration and may lack a
 * scheme. Parsed by hand rather than with `URL`: core is platform-agnostic and
 * compiles against no DOM and no node lib.
 */
function originOf(canonicalUrl: string): string | null {
  const withScheme = /^https?:\/\//i.test(canonicalUrl) ? canonicalUrl : `https://${canonicalUrl}`;
  return /^(https?:\/\/[^/?#]+)/i.exec(withScheme)?.[1] ?? null;
}
