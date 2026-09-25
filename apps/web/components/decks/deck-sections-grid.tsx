import type { DeckSection, DeckSectionKey } from "@ps/core";

import type { DeckViewCard } from "@/lib/decks/deck-view";

const LABELS: Record<DeckSectionKey, string> = {
  command: "Command zone",
  creature: "Creatures",
  planeswalker: "Planeswalkers",
  battle: "Battles",
  instant: "Instants",
  sorcery: "Sorceries",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  other: "Other",
  land: "Lands",
  unknown: "Not found in the card pool",
  sideboard: "Sideboard",
};

/**
 * A deck as card images, section by section.
 *
 * Each image is Scryfall's, whole: never cropped, covered or overlapped, which
 * is their image policy. So the count sits under the card rather than on it,
 * and every card links back to its Scryfall page.
 */
export function DeckSectionsGrid({ sections }: { sections: readonly DeckSection<DeckViewCard>[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`section-${section.key}`}>
          <h2
            id={`section-${section.key}`}
            className="mb-3 border-b border-ink-200 pb-2 text-sm font-semibold tracking-wide text-ink-700 uppercase dark:border-ink-800 dark:text-ink-300"
          >
            {LABELS[section.key]}{" "}
            <span className="font-normal text-ink-500 dark:text-ink-400">({section.count})</span>
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {section.cards.map((card) => (
              <li key={`${card.board}-${card.name}`}>
                <a href={card.scryfallUrl} target="_blank" rel="noreferrer" className="group block">
                  {card.image === null ? (
                    <span className="flex aspect-[488/680] items-center justify-center rounded-lg border border-dashed border-ink-300 p-3 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
                      {card.name}
                    </span>
                  ) : (
                    <img
                      src={card.image}
                      alt={card.name}
                      width={488}
                      height={680}
                      loading="lazy"
                      className="h-auto w-full"
                    />
                  )}
                  <span className="mt-1.5 block truncate text-sm group-hover:underline">
                    <span className="font-medium tabular-nums">{card.qty}×</span> {card.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
