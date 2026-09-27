import type { ReactNode } from "react";

/**
 * The frame the admin pages' filterable tables share (E25): the name filter,
 * the bordered scroll box and the header row, so fetching and processing read
 * as one family. The rows are each page's own.
 */

export function FilterInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <>
      <label htmlFor="filter" className="sr-only">
        {label}
      </label>
      <input
        id="filter"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter by name"
        className="mb-4 w-full max-w-sm rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
      />
    </>
  );
}

/** Every word of the filter appears in the row's text. */
export function matchesFilter(filter: string, text: string): boolean {
  const haystack = text.toLowerCase();
  return filter
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function AdminTable({
  head,
  empty,
  children,
}: {
  head: ReactNode;
  /** Shown under the header when the filter leaves no row. */
  empty: string | null;
  children: ReactNode;
}) {
  return (
    // `relative` keeps an absolutely positioned `sr-only` header inside the
    // scroll box; without it one sat past the screen's edge and a phone zoomed
    // the whole page out to reach it.
    <div className="relative overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 font-mono text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-ink-200 dark:divide-ink-800">{children}</tbody>
      </table>
      {empty !== null && (
        <p className="px-4 py-6 text-sm text-ink-500 dark:text-ink-400">{empty}</p>
      )}
    </div>
  );
}
