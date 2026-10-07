"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

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
  /** Dated outside the Elo time frame, so its matches are not replayed whatever the tick says. */
  readonly outsideWindow: boolean;
  /** False without a single decklist: there is nothing for card statistics to count. */
  readonly hasDecks: boolean;
  readonly cardStats: boolean;
  /** In the order chosen: a deck legal in none of them is checked against the first. */
  readonly formatVersionIds: readonly string[];
}

export interface FormatChoice {
  readonly id: string;
  readonly name: string;
}

type Inclusion = "elo" | "cardStats";

/**
 * Every stored tournament, what it counts towards (E25.3) and the format
 * versions it allowed (E20.66). A tick or a format is saved straight away; for Elo
 * it waits there until the next recompute.
 *
 * The action arrives as a prop, since it reaches `.server.ts` modules (E1.7).
 */
export function InclusionTable({
  rows,
  formats,
  include,
  setFormat,
}: {
  rows: readonly InclusionRow[];
  formats: readonly FormatChoice[];
  include: (id: string, what: Inclusion, on: boolean) => Promise<void>;
  setFormat: (id: string, formatVersionIds: readonly string[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const formatNames = (row: InclusionRow) => namesOf(row.formatVersionIds, formats).join(" ");
  const shown = rows.filter((row) =>
    matchesFilter(filter, `${row.name} ${row.detail} ${formatNames(row)}`),
  );
  const formatSelect = (row: InclusionRow) => (
    <FormatPicker
      label={`Formats: ${row.name}`}
      value={row.formatVersionIds}
      formats={formats}
      set={(ids) => setFormat(row.id, ids)}
    />
  );

  return (
    <>
      <FilterInput value={filter} onChange={setFilter} label="Filter tournaments" />
      <AdminTable
        head={
          <>
            <th className="px-4 py-2 font-medium">Tournament</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Stored</th>
            <th className="hidden px-4 py-2 font-medium md:table-cell">Format</th>
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
              <span className="mt-2 block md:hidden">{formatSelect(row)}</span>
            </td>
            <td className="hidden px-4 py-2 text-xs whitespace-nowrap text-ink-600 sm:table-cell dark:text-ink-400">
              {row.stored}
            </td>
            <td className="hidden px-4 py-2 md:table-cell">{formatSelect(row)}</td>
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
                    {row.elo && row.outsideWindow && <Badge>Outside time frame</Badge>}
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

function namesOf(ids: readonly string[], formats: readonly FormatChoice[]): string[] {
  return ids.flatMap((id) => formats.find((format) => format.id === id)?.name ?? []);
}

/**
 * An event's format versions, saved on every tick. A new tick goes last, so
 * the first one stays first until it is unticked; the last one can't be.
 */
function FormatPicker({
  label,
  value,
  formats,
  set,
}: {
  label: string;
  value: readonly string[];
  formats: readonly FormatChoice[];
  set: (formatVersionIds: readonly string[]) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [chosen, choose] = useOptimistic(value);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) {
        menu.current.open = false;
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...chosen, id] : chosen.filter((c) => c !== id);
    startTransition(async () => {
      choose(next);
      await set(next);
    });
  };
  const names = namesOf(chosen, formats);

  return (
    <details ref={menu} className="relative">
      <summary
        aria-label={label}
        className={`flex max-w-56 cursor-pointer list-none items-center gap-1 rounded-lg border border-ink-300 bg-paper px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-950 [&::-webkit-details-marker]:hidden ${pending ? "opacity-50" : ""}`}
      >
        <span className="truncate">{names.length === 0 ? "No format" : names.join(", ")}</span>
        <span aria-hidden className="ml-auto pl-1 text-ink-500">
          ▾
        </span>
      </summary>
      <fieldset
        disabled={pending}
        className="absolute z-10 mt-1 w-64 space-y-1 rounded-lg border border-ink-200 bg-paper p-2 text-xs shadow-lg dark:border-ink-800 dark:bg-ink-950"
      >
        <legend className="sr-only">{label}</legend>
        {formats.map((format) => {
          const on = chosen.includes(format.id);
          return (
            <label
              key={format.id}
              className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-ink-50 dark:hover:bg-ink-900"
            >
              <input
                type="checkbox"
                checked={on}
                disabled={on && chosen.length === 1}
                onChange={(event) => toggle(format.id, event.target.checked)}
                className="size-4 accent-gold-700"
              />
              <span className="min-w-0 flex-1 truncate">{format.name}</span>
              {on && chosen[0] === format.id && chosen.length > 1 && (
                <span className="text-ink-500 dark:text-ink-400">first</span>
              )}
            </label>
          );
        })}
        <p className="border-t border-ink-200 px-1 pt-1.5 text-ink-500 dark:border-ink-800 dark:text-ink-400">
          Each deck counts in the first of these it is legal in, or the first if none.
        </p>
      </fieldset>
    </details>
  );
}
