import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format-date";
import { loadCurrentFormat } from "@/lib/format/current-format";

/**
 * E17.2 — the legal pool, read from `format_legal_sets` at request time.
 *
 * The point of this component is that it cannot go stale: a pool change is an
 * admin editing rows, and the page says the new thing on the next request. A
 * hand-written table on `/rules` said the right thing only until the next
 * announcement.
 */
export async function LegalSets() {
  const format = await loadCurrentFormat();

  if (!format.ok)
    return <ErrorState title="The legal pool could not be loaded" detail={format.error} />;
  if (format.value === null || format.value.legalSets.length === 0) {
    return (
      <EmptyState title="No pool is published yet">
        The legal sets live in the database so a change needs no deploy. Until a format version is
        marked current, the pool is announced in Discord.
      </EmptyState>
    );
  }

  const { version, legalSets } = format.value;

  return (
    <div className="not-prose my-6 rounded-xl border border-ink-200 p-5 dark:border-ink-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-medium text-ink-900 dark:text-ink-100">{version.name}</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {legalSets.length} sets · in force since {formatDate(version.effectiveFrom)}
        </p>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {legalSets.map((setCode) => (
          <li key={setCode}>
            <Badge variant="outline" className="font-mono text-sm">
              {setCode}
            </Badge>
          </li>
        ))}
      </ul>

      {version.notesMarkdown !== null && (
        <p className="mt-4 text-sm text-ink-600 dark:text-ink-400">{version.notesMarkdown}</p>
      )}
    </div>
  );
}
