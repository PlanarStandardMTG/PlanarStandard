import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import { DeckSectionsList } from "@/components/decks/deck-sections-list";

import type { LoadedDeck } from "./load-deck";

/** A deck inside a post: its name, colours and counts, then the list. */
export function DeckPanel({ deck, title }: { deck: LoadedDeck; title?: string | null }) {
  const { mainCount, sideCount, colors, sections } = deck.view;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`/decks/${deck.id}`}
          className="font-serif text-lg font-semibold text-ink-900 hover:underline dark:text-ink-100"
        >
          {title ?? deck.name}
        </Link>
        <span className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
          <ColorPips colors={colors} />
          {mainCount} cards{sideCount > 0 && `, ${sideCount} sideboard`}
        </span>
      </div>
      {deck.visibility === "private" && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Only you can see this deck. Make it public or unlisted so readers can.
        </p>
      )}
      <DeckSectionsList sections={sections} compact />
    </div>
  );
}
