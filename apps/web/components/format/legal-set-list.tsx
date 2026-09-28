"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { SetSymbol } from "./set-symbol";

export interface LegalSetRow {
  readonly code: string;
  readonly core: boolean;
}

const STEP =
  "grid size-7 cursor-pointer place-items-center rounded-md text-ink-500 hover:bg-ink-100 " +
  "disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent " +
  "dark:text-ink-400 dark:hover:bg-ink-800";

/**
 * A version's legal sets in the order `/rules` lists them, each marked core or
 * rotating. Posts `set` in order and `core_set` for each core one; a code typed
 * under "Other" but never added still posts, as `other_sets`, after the rest.
 */
export function LegalSetList({
  initial,
  knownSets,
  fieldClassName,
}: {
  initial: readonly LegalSetRow[];
  /** The sets the card dataset holds, offered to add with one click. */
  knownSets: readonly string[];
  fieldClassName: string;
}) {
  const [rows, setRows] = useState(initial);
  const [other, setOther] = useState("");

  const move = (from: number, to: number) =>
    setRows((previous) => {
      const next = [...previous];
      const [row] = next.splice(from, 1);
      if (row !== undefined) next.splice(to, 0, row);
      return next;
    });
  const add = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === "") return;
    setRows((previous) =>
      previous.some((row) => row.code === clean)
        ? previous
        : [...previous, { code: clean, core: false }],
    );
  };
  const addOther = () => {
    for (const code of other.split(/[\s,]+/)) add(code);
    setOther("");
  };
  const addable = knownSets.filter((code) => !rows.some((row) => row.code === code));

  return (
    <>
      {rows.length > 0 && (
        <ol className="mt-2 divide-y divide-ink-200 rounded-lg border border-ink-300 dark:divide-ink-800 dark:border-ink-700">
          {rows.map((row, i) => (
            <li key={row.code} className="flex items-center gap-2 px-3 py-1.5">
              <input type="hidden" name="set" value={row.code} />
              {row.core && <input type="hidden" name="core_set" value={row.code} />}
              <span className="w-5 text-right font-mono text-xs text-ink-400 tabular-nums">
                {i + 1}
              </span>
              <SetSymbol code={row.code} className="text-lg" />
              <span className="flex-1 font-mono text-sm">{row.code}</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600 dark:text-ink-400">
                <input
                  type="checkbox"
                  checked={row.core}
                  onChange={(e) =>
                    setRows((previous) =>
                      previous.map((r, j) => (j === i ? { ...r, core: e.target.checked } : r)),
                    )
                  }
                />
                Core
              </label>
              <span className="flex">
                <button
                  type="button"
                  aria-label={`Move ${row.code} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className={STEP}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  aria-label={`Move ${row.code} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, i + 1)}
                  className={STEP}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${row.code}`}
                  onClick={() => setRows((previous) => previous.filter((_, j) => j !== i))}
                  className={cn(STEP, "hover:text-red-700 dark:hover:text-red-400")}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {addable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500 dark:text-ink-400">Add</span>
          {addable.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => add(code)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-ink-300 px-2.5 py-1 font-mono text-sm hover:border-eclipse-500 dark:border-ink-700"
            >
              <SetSymbol code={code} />
              {code}
            </button>
          ))}
        </div>
      )}

      <label htmlFor="other_sets" className="mt-3 block text-xs text-ink-500 dark:text-ink-400">
        Other set codes, comma-separated — for a set the card data doesn’t hold yet
      </label>
      <div className="flex items-end gap-2">
        <input
          id="other_sets"
          name="other_sets"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addOther();
          }}
          className={`${fieldClassName} font-mono`}
        />
        <button
          type="button"
          onClick={addOther}
          className="cursor-pointer rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900"
        >
          Add
        </button>
      </div>
    </>
  );
}
