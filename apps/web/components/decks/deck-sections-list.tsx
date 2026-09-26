import type { DeckSection } from "@ps/core";

import { CardHoverLink } from "@/components/decks/card-hover-link";
import { SECTION_LABELS } from "@/components/decks/section-labels";
import type { DeckViewCard } from "@/lib/decks/deck-view";

const byCopiesThenName = (a: DeckViewCard, b: DeckViewCard) =>
  b.qty - a.qty || a.name.localeCompare(b.name);

/**
 * A deck as a text list, section by section, flowed into as many columns as
 * the screen fits. Hovering a name shows its card.
 */
export function DeckSectionsList({
  sections,
  compact = false,
}: {
  sections: readonly DeckSection<DeckViewCard>[];
  /** Two columns at most, for a list inside a post's measure. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "gap-x-6 text-sm sm:columns-2" : "gap-x-8 sm:columns-2 lg:columns-3"}>
      {sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`section-${section.key}`}
          className="mb-8 break-inside-avoid"
        >
          <h2
            id={`section-${section.key}`}
            className="mb-2 border-b border-ink-200 pb-2 text-sm font-semibold dark:border-ink-800"
          >
            {SECTION_LABELS[section.key]} ({section.count})
          </h2>
          <ul>
            {[...section.cards].sort(byCopiesThenName).map((card) => (
              <li key={`${card.board}-${card.name}`} className="flex gap-3 py-1">
                <span className="w-4 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {card.qty}
                </span>
                <CardHoverLink
                  href={card.scryfallUrl}
                  image={card.image}
                  className="text-ink-700 hover:underline dark:text-ink-300"
                >
                  {card.name}
                </CardHoverLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
