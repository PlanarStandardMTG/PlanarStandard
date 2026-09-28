import { EmptyState, ErrorState } from "@/components/ui/states";
import { loadCurrentFormat } from "@/lib/format/current-format";

import { scryfallSetSearch, SetSymbol } from "./set-symbol";

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
        The pool is announced in the Discord.
      </EmptyState>
    );
  }

  const { version, legalSets, coreSets } = format.value;
  const rotating = legalSets.filter((code) => !coreSets.includes(code));

  return (
    <div className="not-prose my-6 rounded-xl border border-ink-200 p-5 dark:border-ink-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-medium text-ink-900 dark:text-ink-100">{version.name}</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">{legalSets.length} sets</p>
      </div>

      {coreSets.length === 0 ? (
        <SetChips codes={legalSets} />
      ) : (
        <>
          <SetGroup label="Core" codes={coreSets} />
          {rotating.length > 0 && <SetGroup label="Rotating" codes={rotating} />}
        </>
      )}

      {version.notesMarkdown !== null && (
        <p className="mt-4 text-sm text-ink-600 dark:text-ink-400">{version.notesMarkdown}</p>
      )}
    </div>
  );
}

function SetGroup({ label, codes }: { label: string; codes: readonly string[] }) {
  return (
    <div className="mt-4">
      <p className="font-mono text-xs tracking-[0.08em] text-ink-500 uppercase dark:text-ink-400">
        {label}
      </p>
      <SetChips codes={codes} />
    </div>
  );
}

function SetChips({ codes }: { codes: readonly string[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {codes.map((code) => (
        <li key={code}>
          <a
            href={scryfallSetSearch(code)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${code} on Scryfall`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 px-3 py-1 font-mono text-sm text-ink-700 transition-colors hover:border-eclipse-500 hover:text-eclipse-700 dark:border-ink-700 dark:text-ink-300 dark:hover:text-eclipse-400"
          >
            <SetSymbol code={code} />
            {code}
          </a>
        </li>
      ))}
    </ul>
  );
}
