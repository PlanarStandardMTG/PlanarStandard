"use client";

import type { ReactNode } from "react";

import { DECK_LAYOUT, writePreference } from "@/lib/preferences";
import { usePreference } from "@/lib/use-preference";

/**
 * A deck as a text list or as card images, whichever the reader chose last.
 * The server renders the list; the grid mounts only once the stored choice has
 * been read and says images, so a reader who prefers text never loads one.
 */
export function DeckLayoutToggle({
  list,
  grid,
  buttonClassName,
}: {
  list: ReactNode;
  grid: ReactNode;
  buttonClassName: string;
}) {
  const layout = usePreference(DECK_LAYOUT);
  const showImages = layout === "images";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => writePreference(DECK_LAYOUT, showImages ? "text" : "images")}
          className={`${buttonClassName} cursor-pointer hover:border-ink-500`}
        >
          {showImages ? "Show as text" : "Show as images"}
        </button>
      </div>
      {showImages ? grid : list}
    </>
  );
}
