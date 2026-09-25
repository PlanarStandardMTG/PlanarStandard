"use client";

import { useRef } from "react";

import { deleteFormat } from "@/app/admin/formats/actions";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-3 py-1.5 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

/** Delete a format version, after the admin confirms it (E20.33). */
export function DeleteFormatButton({ id, name }: { id: string; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`${OUTLINE_BUTTON} hover:border-red-400 hover:text-red-700 dark:hover:text-red-400`}
      >
        Delete version
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-format-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-white p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <h2 id="delete-format-title" className="font-semibold">
          Delete “{name}”?
        </h2>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
          Its legal sets, deck limits and card rules go with it. A version that any season,
          tournament or deck was checked against can’t be deleted.
        </p>
        <form action={deleteFormat} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="id" value={id} />
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
            Delete version
          </button>
        </form>
      </dialog>
    </>
  );
}
