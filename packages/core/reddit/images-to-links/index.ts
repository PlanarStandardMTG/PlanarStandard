/**
 * A Reddit self-post cannot inline an image, so an `![alt](url)` renders as
 * nothing at all. Demote each one to an ordinary link that says what it was.
 */
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function imagesToLinks(markdown: string): string {
  return markdown.replace(IMAGE, (_match, alt: string, url: string) => {
    const label = alt.trim().length > 0 ? alt.trim() : "image";
    return `[${label}](${url})`;
  });
}
