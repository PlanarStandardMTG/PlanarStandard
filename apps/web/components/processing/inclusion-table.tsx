"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { AdminTable, FilterInput, matchesFilter } from "@/components/ui/admin-table";
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
  const shown = rows.filter((row) => matchesFilter(filter, `${row.name} ${row.detail}`));

  return (
    <>
      <FilterInput value={filter} onChange={setFilter} label="Filter tournaments" />
      <AdminTable
        head={
          <>
            <th className="px-4 py-2 font-medium">Tournament</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Stored</th>
            <th className="px-4 py-2 font-medium">Elo</th>
            <th className="px-4 py-2 font-medium">Card stats</th>
          </>
        }
        empty={shown.length === 0 ? "No tournament matches that filter." : null}
      >
        {shown.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-2 align-top sm:align-middle">
              <Link href={row.href} className="font-medium hover:underline">
                {row.name}
              </Link>
              <span className="block text-xs text-ink-500 dark:text-ink-400">{row.detail}</span>
              {/* On a phone the stored column folds in here, so the row fits the screen. */}
              <span className="mt-2 block text-xs text-ink-600 sm:hidden dark:text-ink-400">
                {row.stored}
              </span>
            </td>
            <td className="hidden px-4 py-2 text-xs whitespace-nowrap text-ink-600 sm:table-cell dark:text-ink-400">
              {row.stored}
            </td>
            <td className="px-4 py-2 align-top sm:align-middle">
              <span className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:whitespace-nowrap">
                {row.rateable ? (
                  <>
                    <Tick
                      label={`Elo: ${row.name}`}
                      on={row.elo}
                      set={(on) => include(row.id, "elo", on)}
                    />
                    {row.eloWaiting && <Badge variant="accent">Waiting</Badge>}
                  </>
                ) : (
                  <Missing>No matches</Missing>
                )}
              </span>
            </td>
            <td className="px-4 py-2 align-top sm:align-middle">
              <span className="flex items-center gap-2 sm:whitespace-nowrap">
                {row.hasDecks ? (
                  <Tick
                    label={`Card stats: ${row.name}`}
                    on={row.cardStats}
                    set={(on) => include(row.id, "cardStats", on)}
                  />
                ) : (
                  <Missing>No decklists</Missing>
                )}
              </span>
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}

/**
 * In place of a box that would mean nothing: a tick would claim the event
 * counts when there is nothing to count. An error, not a hint.
 */
function Missing({ children }: { children: string }) {
  return <span className="text-xs text-red-700 dark:text-red-400">{children}</span>;
}

function Tick({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (on: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={on}
      disabled={pending}
      onChange={(event) => {
        const checked = event.target.checked;
        startTransition(() => set(checked));
      }}
      className="size-4 accent-gold-700 disabled:opacity-50"
    />
  );
}
