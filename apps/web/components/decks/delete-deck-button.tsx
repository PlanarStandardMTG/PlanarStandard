"use client";

import { useRef } from "react";

import { deleteDeck } from "@/app/decks/actions";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

/**
 * Delete a deck, after the owner confirms it. Every version goes with it
 * (E20.30), so the dialog says how many.
 */
export function DeleteDeckButton({
  deckId,
  deckName,
  versions,
}: {
  deckId: string;
  deckName: string;
  versions: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`${OUTLINE_BUTTON} hover:border-red-400 hover:text-red-700 dark:hover:text-red-400`}
      >
        Delete deck
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-white p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <h2 id="delete-title" className="font-semibold">
          Delete “{deckName}”?
        </h2>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
          {versions > 1
            ? `All ${versions} versions of this deck will be deleted. This can’t be undone.`
            : "This can’t be undone."}
        </p>
        <form action={deleteDeck} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={deckId} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={`${OUTLINE_BUTTON} px-4 py-2 hover:border-ink-500`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Delete deck
          </button>
        </form>
      </dialog>
    </>
  );
}
