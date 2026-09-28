import type { FormatVersionDetail, OracleId } from "@ps/contracts";

/**
 * An info page's MDX body as plain Markdown, for `/llms-full.txt`: comments
 * dropped, the data components written out as text, and site links made
 * absolute so a reader outside the site can follow them.
 */
export function pageMarkdown(body: string, { origin, format, cardName }: MarkdownContext): string {
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}\n?/g, "")
    .replace(/<LegalSets\s*\/>/g, legalSetsText(format))
    .replace(/<Banlist\s*\/>/g, banlistText(format, cardName))
    .replace(/\]\(\//g, `](${origin}/`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface MarkdownContext {
  readonly origin: string;
  readonly format: FormatVersionDetail | null;
  readonly cardName: (oracleId: OracleId) => string;
}

export function legalSetsText(format: FormatVersionDetail | null): string {
  if (format === null || format.legalSets.length === 0)
    return "The pool is announced in the Discord.";
  const sets = format.legalSets.map((code) =>
    format.coreSets.includes(code) ? `${code} (core)` : code,
  );
  return `Legal sets (${format.version.name}): ${sets.join(", ")}.`;
}

function banlistText(
  format: FormatVersionDetail | null,
  cardName: (oracleId: OracleId) => string,
): string {
  if (format === null) return "No banlist is published yet.";
  if (format.cardRules.length === 0) return "No cards are banned.";
  return format.cardRules
    .map((rule) => {
      const ruling =
        rule.ruling === "restricted"
          ? `restricted to ${rule.limit}`
          : rule.ruling === "legal_exception"
            ? "legal exception"
            : "banned";
      return `- ${cardName(rule.oracleId)}: ${ruling}`;
    })
    .join("\n");
}
