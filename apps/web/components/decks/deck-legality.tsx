import type { DeckFormat, LegalityVerdict } from "@ps/contracts";

import { FORMAT_LABELS } from "@/components/decks/format-labels";

/**
 * The deck's format, and whether it is legal there. Checked when the page is
 * viewed, so a ban announced after the save shows without anything re-saved.
 * The reasons are the editor's to show (E20.30).
 */
export function DeckLegality({
  format,
  verdict,
}: {
  format: DeckFormat;
  verdict: LegalityVerdict | null;
}) {
  const label = FORMAT_LABELS[format];

  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {verdict === null ? (
        <span className="text-ink-500 dark:text-ink-400">(not checked)</span>
      ) : verdict.legal ? (
        <span
          role="img"
          aria-label={`Legal in ${label}`}
          className="font-semibold text-emerald-600 dark:text-emerald-400"
        >
          ✓
        </span>
      ) : (
        <span
          role="img"
          aria-label={`Not legal in ${label}`}
          className="font-semibold text-red-600 dark:text-red-400"
        >
          ✗
        </span>
      )}
    </span>
  );
}
