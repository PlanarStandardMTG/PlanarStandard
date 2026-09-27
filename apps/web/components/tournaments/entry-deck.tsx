import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import type { EntryDeck } from "@/lib/tournaments/tournament-view";

/** The deck a player brought, linked to its list; the archetype when the list has no name. */
export function EntryDeckLink({ deck }: { deck: EntryDeck }) {
  return (
    <Link href={`/decks/${deck.id}`} className="group inline-flex min-w-0 items-center gap-2">
      <ColorPips colors={deck.colors} className="w-10 shrink-0" />
      <span className="truncate text-eclipse-700 group-hover:underline dark:text-eclipse-400">
        {deck.name ?? deck.archetype ?? "Decklist"}
      </span>
    </Link>
  );
}
