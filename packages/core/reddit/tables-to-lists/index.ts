/**
 * Reddit renders Markdown tables inconsistently — old.reddit does not render
 * them at all — so a metagame table published as-is is unreadable for a large
 * share of the audience. Flatten each one into a list.
 *
 * The first column becomes the item; the rest become `Header: value` pairs,
 * which keeps the numbers attached to their meaning.
 */

const SEPARATOR_ROW = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

export function tablesToLists(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i] as string;
    const separator = lines[i + 1];

    if (!isTableRow(header) || separator === undefined || !SEPARATOR_ROW.test(separator)) {
      out.push(header);
      continue;
    }

    const headings = splitRow(header);
    let cursor = i + 2;
    const body: string[][] = [];
    while (cursor < lines.length && isTableRow(lines[cursor] as string)) {
      body.push(splitRow(lines[cursor] as string));
      cursor += 1;
    }

    for (const row of body) out.push(renderRow(headings, row));
    // A table with a header but no rows leaves nothing behind but its meaning.
    if (body.length === 0) out.push(headings.join(" / "));

    i = cursor - 1;
  }

  return out.join("\n");
}

function isTableRow(line: string): boolean {
  return line.includes("|") && line.trim().length > 0 && !SEPARATOR_ROW.test(line);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderRow(headings: readonly string[], row: readonly string[]): string {
  const [first = "", ...rest] = row;
  const pairs = rest
    .map((cell, index) => {
      const heading = headings[index + 1];
      if (cell.length === 0) return null;
      return heading === undefined || heading.length === 0 ? cell : `${heading}: ${cell}`;
    })
    .filter((pair): pair is string => pair !== null);

  return pairs.length === 0 ? `- **${first}**` : `- **${first}** — ${pairs.join(", ")}`;
}
