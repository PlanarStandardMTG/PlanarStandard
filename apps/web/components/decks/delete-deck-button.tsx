"use client";

import { useRef, useState } from "react";

import { deleteDeckVersions } from "@/app/decks/actions";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

export interface DeletableVersion {
  readonly id: string;
  readonly label: string;
  readonly date: string;
}

/**
 * Delete some or all versions of a deck, chosen in a dialog (E20.31). The page
 * being viewed starts ticked. To the member they are gone; the rows are hidden
 * rather than deleted, which is the action's business and not this dialog's.
 */
export function DeleteDeckButton({
  deckId,
  deckName,
  versions,
  current,
}: {
  deckId: string;
  deckName: string;
  /** Oldest first. */
  versions: readonly DeletableVersion[];
  current: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set([current]));

  const toggle = (id: string) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const everything = chosen.size === versions.length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setChosen(new Set([current]));
          dialogRef.current?.showModal();
        }}
        className={`${OUTLINE_BUTTON} hover:border-red-400 hover:text-red-700 dark:hover:text-red-400`}
      >
        Delete deck
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-paper p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <form action={deleteDeckVersions}>
          <input type="hidden" name="id" value={deckId} />
          <h2 id="delete-title" className="font-semibold">
            Delete “{deckName}”
          </h2>

          {versions.length > 1 ? (
            <fieldset className="mt-3">
              <legend className="text-sm text-ink-600 dark:text-ink-400">
                Which versions? The ones you keep stay in order.
              </legend>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {[...versions].reverse().map((version) => (
                  <li key={version.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                      <input
                        type="checkbox"
                        name="version"
                        value={version.id}
                        checked={chosen.has(version.id)}
                        onChange={() => toggle(version.id)}
                      />
                      <span className="flex-1">
                        {version.label}
                        {version.id === current && (
                          <span className="text-ink-500 dark:text-ink-400"> · this page</span>
                        )}
                      </span>
                      <span className="text-xs text-ink-500 dark:text-ink-400">{version.date}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  setChosen(everything ? new Set() : new Set(versions.map((v) => v.id)))
                }
                className="mt-2 text-xs text-ink-600 underline dark:text-ink-400"
              >
                {everything ? "Select none" : "Select all"}
              </button>
            </fieldset>
          ) : (
            <input type="hidden" name="version" value={current} />
          )}

          <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
            {everything ? "The whole deck will be deleted. " : ""}This can’t be undone.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${OUTLINE_BUTTON} px-4 py-2 hover:border-ink-500`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={chosen.size === 0}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {versions.length > 1 && !everything
                ? `Delete ${chosen.size} ${chosen.size === 1 ? "version" : "versions"}`
                : "Delete deck"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
