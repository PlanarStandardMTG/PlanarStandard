"use client";

import { useState, useTransition } from "react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";

type Line = "elo" | "decklists";

export interface LineRow<K> {
  readonly key: K;
  readonly name: string;
  readonly detail: string;
  readonly status: string;
  readonly variant: BadgeVariant;
  readonly error: string | null;
  readonly processed: boolean;
  readonly elo: boolean;
  readonly decklists: boolean;
}

const LINES: readonly { line: Line; label: string; leave: string }[] = [
  { line: "elo", label: "Elo", leave: "Remove from Elo" },
  { line: "decklists", label: "Decklists", leave: "Remove decklists" },
];

/**
 * Every finished tournament and the two lines it can go down (E18.22). While it
 * waits, a tick puts it on a line; once processed the ticks are fixed, and
 * taking it off a line undoes that line's work.
 *
 * The actions arrive as props: they reach `.server.ts` modules, which a client
 * module may not import (E1.7).
 */
export function TournamentLines<K>({
  rows,
  choose,
  leave,
}: {
  rows: readonly LineRow<K>[];
  choose: (key: K, line: Line, on: boolean) => Promise<void>;
  leave: (key: K, line: Line) => Promise<void>;
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
              <th className="px-4 py-2 font-medium">Status</th>
              {LINES.map(({ line, label }) => (
                <th key={line} className="px-4 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {shown.map((row) => (
              <tr key={row.detail}>
                <td className="px-4 py-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{row.detail}</span>
                  {row.error !== null && (
                    <span className="block text-xs text-red-700 dark:text-red-400">
                      {row.error}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <Badge variant={row.variant}>{row.status}</Badge>
                </td>
                {LINES.map(({ line, label, leave: leaveLabel }) => (
                  <td key={line} className="px-4 py-2">
                    <LineCell
                      label={`${label}: ${row.name}`}
                      on={row[line]}
                      processed={row.processed}
                      leaveLabel={leaveLabel}
                      choose={(on) => choose(row.key, line, on)}
                      leave={() => leave(row.key, line)}
                    />
                  </td>
                ))}
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

/** A tick, and once processed, a two-press way off the line. */
function LineCell({
  label,
  on,
  processed,
  leaveLabel,
  choose,
  leave,
}: {
  label: string;
  on: boolean;
  processed: boolean;
  leaveLabel: string;
  choose: (on: boolean) => Promise<void>;
  leave: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <span className="flex items-center gap-3 whitespace-nowrap">
      <input
        type="checkbox"
        aria-label={label}
        checked={on}
        disabled={processed || pending}
        onChange={(event) => {
          const checked = event.target.checked;
          startTransition(() => choose(checked));
        }}
        className="size-4 accent-gold-700 disabled:opacity-50"
      />
      {processed && on && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirming) return setConfirming(true);
            startTransition(() => leave());
          }}
          onBlur={() => setConfirming(false)}
          className="text-xs text-ink-500 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50 dark:text-ink-400 dark:hover:text-red-400"
        >
          {pending ? "Removing…" : confirming ? "Press again to confirm" : leaveLabel}
        </button>
      )}
    </span>
  );
}
