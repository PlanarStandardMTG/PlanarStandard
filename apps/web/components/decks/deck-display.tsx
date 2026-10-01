"use client";

import type { DeckSection } from "@ps/core";

import { DeckSectionsGrid } from "@/components/decks/deck-sections-grid";
import { DeckSectionsList } from "@/components/decks/deck-sections-list";
import { orderCards } from "@/lib/decks/card-order";
import type { DeckViewCard } from "@/lib/decks/deck-view";
import { DECK_LAYOUT, DECK_ORDER, writePreference } from "@/lib/preferences";
import { usePreference } from "@/lib/use-preference";

/**
 * A deck as a text list or as card images, by name or by mana value, whichever
 * the reader chose last. The server renders the list by name; the grid mounts
 * only once the stored choice has been read and says images, so a reader who
 * prefers text never loads one.
 */
export function DeckDisplay({
  sections,
  buttonClassName,
}: {
  sections: readonly DeckSection<DeckViewCard>[];
  buttonClassName: string;
}) {
  const layout = usePreference(DECK_LAYOUT);
  const order = usePreference(DECK_ORDER);
  const showImages = layout === "images";
  const byManaValue = order === "mana-value";
  const ordered = orderCards(sections, order);
  const button = `${buttonClassName} cursor-pointer hover:border-ink-500`;

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => writePreference(DECK_ORDER, byManaValue ? "name" : "mana-value")}
          className={button}
        >
          {byManaValue ? "Sort by name" : "Sort by mana value"}
        </button>
        <button
          type="button"
          onClick={() => writePreference(DECK_LAYOUT, showImages ? "text" : "images")}
          className={button}
        >
          {showImages ? "Show as text" : "Show as images"}
        </button>
      </div>
      {showImages ? (
        <DeckSectionsGrid sections={ordered} />
      ) : (
        <DeckSectionsList sections={ordered} />
      )}
    </>
  );
}
