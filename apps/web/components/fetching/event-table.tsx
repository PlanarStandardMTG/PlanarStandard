"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";

export interface EventRow<K> {
  readonly key: K;
  readonly name: string;
  readonly detail: string;
  readonly status: string;
  readonly variant: BadgeVariant;
  /** Why the last fetch failed, or why it stored nothing. */
  readonly note: string | null;
  /** What the fetch stored, when it stored a tournament. */
  readonly stored: string | null;
  readonly href: string | null;
  /** A link beside the re-fetch button, such as the decklist tab's "Add decklists". */
  readonly action?: { readonly label: string; readonly href: string };
}

/**
 * The fetch queue as a table (E25.2): each finished event, where its fetch
 * stands, what it stored, and a button that fetches it again.
 *
 * The action arrives as a prop: it reaches `.server.ts` modules, which a client
 * module may not import (E1.7).
 */
export function EventTable<K>({
  rows,
  refetch,
}: {
  rows: readonly EventRow<K>[];
  refetch: (key: K) => Promise<string>;
}) {
  const [filter, setFilter] = useState("");
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((row) => {
    const text = `${row.name} ${row.detail}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  return (
    <>
      <label htmlFor="filter" className="sr-only">
        Filter events
      </label>
      <input
        id="filter"
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by name"
        className="mb-4 w-full max-w-sm rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
      />
      {/* `relative` keeps the absolutely positioned `sr-only` header inside the
          scroll box; without it the header sat past the screen's edge and a phone
          zoomed the whole page out to reach it. */}
      <div className="relative overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 font-mono text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <tr>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Status</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Stored</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {shown.map((row) => (
              <tr key={row.detail}>
                <td className="px-4 py-2 align-top sm:align-middle">
                  {row.href === null ? (
                    <span className="font-medium">{row.name}</span>
                  ) : (
                    <Link href={row.href} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  )}
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{row.detail}</span>
                  {row.note !== null && (
                    <span className="block text-xs [overflow-wrap:anywhere] text-red-700 dark:text-red-400">
                      {row.note}
                    </span>
                  )}
                  {/* On a phone the two middle columns fold in here, so the row fits the screen. */}
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-600 sm:hidden dark:text-ink-400">
                    <Badge variant={row.variant}>{row.status}</Badge>
                    {row.stored ?? "Nothing stored"}
                  </span>
                </td>
                <td className="hidden px-4 py-2 whitespace-nowrap sm:table-cell">
                  <Badge variant={row.variant}>{row.status}</Badge>
                </td>
                <td className="hidden px-4 py-2 text-xs whitespace-nowrap text-ink-600 sm:table-cell dark:text-ink-400">
                  {row.stored ?? "Nothing"}
                </td>
                <td className="px-4 py-2 text-right align-top sm:align-middle">
                  <span className="inline-flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {row.action !== undefined && (
                      <Link
                        href={row.action.href}
                        className="text-xs font-medium whitespace-nowrap text-eclipse-700 hover:underline dark:text-eclipse-400"
                      >
                        {row.action.label}
                      </Link>
                    )}
                    <RefetchButton refetch={() => refetch(row.key)} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-500 dark:text-ink-400">
            No event matches that filter.
          </p>
        )}
      </div>
    </>
  );
}

/** Fetches one event now; says what came of it until the next render replaces the row. */
function RefetchButton({ refetch }: { refetch: () => Promise<string> }) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col-reverse items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
      {outcome !== null && (
        <span className="max-w-40 text-right text-xs [overflow-wrap:anywhere] text-ink-500 dark:text-ink-400">
          {outcome}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setOutcome(await refetch());
          })
        }
        className="cursor-pointer whitespace-nowrap rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:hover:bg-ink-900"
      >
        {pending ? "Fetching…" : "Re-fetch"}
      </button>
    </span>
  );
}
