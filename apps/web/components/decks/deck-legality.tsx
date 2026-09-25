import type { LegalityVerdict } from "@ps/contracts";

/**
 * The deck against the format in force, checked when the page is viewed — so a
 * ban announced after the import shows up without anything being re-saved.
 */
export function DeckLegality({
  verdict,
  formatName,
}: {
  verdict: LegalityVerdict | null;
  formatName: string | undefined;
}) {
  if (verdict === null) {
    return (
      <p className="rounded-xl border border-ink-200 px-4 py-3 text-sm text-ink-600 dark:border-ink-800 dark:text-ink-400">
        No format is in force, so this deck has not been checked.
      </p>
    );
  }

  const name = formatName ?? "the current format";
  if (verdict.legal) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        Legal in {name}.
      </p>
    );
  }

  const issues = [...verdict.deckIssues, ...verdict.cardIssues];
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Not legal in {name}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {issues.map((issue) => (
          <li key={issue.message}>{sentence(issue.message)}</li>
        ))}
      </ul>
    </div>
  );
}

const sentence = (message: string) => message.charAt(0).toUpperCase() + message.slice(1) + ".";
