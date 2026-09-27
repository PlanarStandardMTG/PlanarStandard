"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";

export interface InclusionRow {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly detail: string;
  readonly stored: string;
  /** False without matches: pairings are never inferred from placements (ADR 006). */
  readonly rateable: boolean;
  readonly elo: boolean;
  /** The ladder has not caught up with `elo` yet. */
  readonly eloWaiting: boolean;
  /** False without a single decklist: there is nothing for card statistics to count. */
  readonly hasDecks: boolean;
  readonly cardStats: boolean;
}

type Inclusion = "elo" | "cardStats";

/**
 * Every stored tournament and what it counts towards (E25.3). A tick is saved
 * straight away; for Elo it waits there until the next recompute.
 *
 * The action arrives as a prop, since it reaches `.server.ts` modules (E1.7).
 */
export function InclusionTable({
  rows,
  include,
}: {
  rows: readonly InclusionRow[];
  include: (id: string, what: Inclusion, on: boolean) => Promise<void>;
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
        Filter tournaments
      </label>
      <input
        id="filter"
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by name"
        className="mb-4 w-full max-w-sm rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
      />
      <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 font-mono text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <tr>
              <th className="px-4 py-2 font-medium">Tournament</th>
              <th className="px-4 py-2 font-medium">Stored</th>
              <th className="px-4 py-2 font-medium">Elo</th>
              <th className="px-4 py-2 font-medium">Card stats</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2">
                  <Link href={row.href} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{row.detail}</span>
                </td>
                <td className="px-4 py-2 text-xs whitespace-nowrap text-ink-600 dark:text-ink-400">
                  {row.stored}
                </td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Tick
                      label={`Elo: ${row.name}`}
                      on={row.elo}
                      disabled={!row.rateable}
                      set={(on) => include(row.id, "elo", on)}
                    />
                    {row.eloWaiting && <Badge variant="accent">Waiting</Badge>}
                    {!row.rateable && <Missing>No matches</Missing>}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Tick
                      label={`Card stats: ${row.name}`}
                      on={row.cardStats}
                      disabled={!row.hasDecks}
                      set={(on) => include(row.id, "cardStats", on)}
                    />
                    {!row.hasDecks && <Missing>No decklists</Missing>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-500 dark:text-ink-400">
            No tournament matches that filter.
          </p>
        )}
      </div>
    </>
  );
}

/** What a tournament lacks for a box to mean anything: an error, not a hint. */
function Missing({ children }: { children: string }) {
  return <span className="text-xs text-red-700 dark:text-red-400">{children}</span>;
}

function Tick({
  label,
  on,
  disabled,
  set,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  set: (on: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={on}
      disabled={disabled || pending}
      onChange={(event) => {
        const checked = event.target.checked;
        startTransition(() => set(checked));
      }}
      className="size-4 accent-gold-700 disabled:opacity-50"
    />
  );
}
