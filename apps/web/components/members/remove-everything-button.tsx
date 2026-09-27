"use client";

import { useRef, useState } from "react";

const OUTLINE_BUTTON =
  "cursor-pointer rounded-lg border border-ink-300 px-4 py-2 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

/**
 * Remove every post and saved deck a member made (E20.42). The admin types the
 * member's name to confirm, as `RerunEverythingButton` asks for a word: this
 * cannot be undone, and the name makes sure it lands on the right person.
 */
export function RemoveEverythingButton({
  memberId,
  name,
  posts,
  decks,
  action,
}: {
  memberId: string;
  name: string;
  posts: number;
  decks: number;
  action: (form: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          dialogRef.current?.showModal();
        }}
        className={`${OUTLINE_BUTTON} hover:border-red-400 hover:text-red-700 dark:hover:text-red-400`}
      >
        Remove everything
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="remove-all-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-paper p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <form action={action}>
          <input type="hidden" name="member" value={memberId} />
          <h2 id="remove-all-title" className="font-semibold">
            Remove everything {name} made?
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-600 dark:text-ink-400">
            <li>
              {posts === 1 ? "Their 1 post is" : `All ${posts} of their posts are`} deleted, drafts
              included.
            </li>
            <li>
              {decks === 1 ? "Their 1 saved deck is" : `All ${decks} of their saved decks are`}{" "}
              deleted with every version. A deck an event names is hidden instead, so the event
              keeps its list.
            </li>
            <li>Their account, role and tournament results stay. Banning is separate.</li>
          </ul>
          <label htmlFor="remove-all-confirm" className="mt-4 block text-sm">
            Type <span className="font-semibold">{name}</span> to confirm
          </label>
          <input
            id="remove-all-confirm"
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${OUTLINE_BUTTON} hover:border-ink-500`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={typed.trim() !== name}
              className="cursor-pointer rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove everything
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
