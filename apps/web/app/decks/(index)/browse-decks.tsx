import type { Color } from "@ps/contracts";
import { colorIdentity, latestVersions, matchesDeckFilter, type DeckFilter } from "@ps/core";
import { listBrowsableDecks } from "@ps/db";
import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import { FORMAT_LABELS } from "@/components/decks/format-labels";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cardIndex } from "@/lib/cards/card-index";
import { toResolvedDeck } from "@/lib/decks/deck-view";
import { formatDate } from "@/lib/format-date";
import { load } from "@/lib/load";
import { createSessionClient } from "@/lib/supabase/session";

const PAGE_SIZE = 10;

const COLORS: readonly { color: Color; label: string }[] = [
  { color: "W", label: "White" },
  { color: "U", label: "Blue" },
  { color: "B", label: "Black" },
  { color: "R", label: "Red" },
  { color: "G", label: "Green" },
];

type Params = Record<string, string | string[] | undefined>;

const all = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** The browser's filter as the URL carries it: `?color=W&color=U&cards=Shock;Opt&page=2`. */
function readFilter(params: Params): DeckFilter & { readonly text: string } {
  const text = all(params["cards"])[0] ?? "";
  return {
    colors: COLORS.map((c) => c.color).filter((color) => all(params["color"]).includes(color)),
    cards: text
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean),
    text,
  };
}

function pageHref(filter: DeckFilter & { text: string }, page: number) {
  const query = new URLSearchParams();
  for (const color of filter.colors) query.append("color", color);
  if (filter.text.trim() !== "") query.set("cards", filter.text);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search === "" ? "/decks" : `/decks?${search}`;
}

/**
 * The Browse tab (E20.40): every public deck at its newest version, narrowed
 * by colour and card name, ten to a page. Cards are not in Postgres, so the
 * filter runs here against the card index rather than in the query.
 */
export async function BrowseDecks({ params }: { params: Params }) {
  const filter = readFilter(params);
  const decks = await load(async () => listBrowsableDecks(await createSessionClient()));
  if (!decks.ok) return <ErrorState title="Decks could not be loaded" detail={decks.error} />;

  const index = cardIndex();
  const matching = latestVersions(decks.value).flatMap(({ deck }) => {
    const resolved = toResolvedDeck(deck);
    return matchesDeckFilter(resolved, index, filter)
      ? [{ deck, colors: colorIdentity(resolved, index) }]
      : [];
  });

  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(all(params["page"])[0]) || 1));
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtering = filter.colors.length > 0 || filter.cards.length > 0;

  return (
    <section aria-label="Browse decks">
      <FilterMenu filter={filter} active={filtering} />

      {shown.length === 0 ? (
        <EmptyState title={filtering ? "No deck matches that filter" : "No public decks yet"}>
          {filtering ? (
            <Link href="/decks" className="underline underline-offset-2">
              Clear the filter
            </Link>
          ) : (
            "Public decks will be listed here."
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
            {shown.map(({ deck, colors }) => (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ColorPips colors={colors} className="w-12 shrink-0" />
                    <span className="truncate font-medium">{deck.name}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                    {deck.archetypeRaw !== null && deck.archetypeRaw !== deck.name && (
                      <span>{deck.archetypeRaw}</span>
                    )}
                    <span>{FORMAT_LABELS[deck.format]}</span>
                    {formatDate(deck.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav
            aria-label="Pages"
            className="mt-4 flex items-center justify-between text-sm text-ink-600 dark:text-ink-400"
          >
            <PageLink href={page > 1 ? pageHref(filter, page - 1) : null}>← Newer</PageLink>
            <span>
              Page {page} of {pages} · {matching.length} {matching.length === 1 ? "deck" : "decks"}
            </span>
            <PageLink href={page < pages ? pageHref(filter, page + 1) : null}>Older →</PageLink>
          </nav>
        </>
      )}
    </section>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href === null ? (
    <span aria-hidden="true" className="opacity-40">
      {children}
    </span>
  ) : (
    <Link href={href} className="font-medium text-ink-900 hover:underline dark:text-ink-100">
      {children}
    </Link>
  );
}

/** A plain GET form in a disclosure, so filtering works without any client script. */
function FilterMenu({
  filter,
  active,
}: {
  filter: DeckFilter & { text: string };
  active: boolean;
}) {
  const count = filter.colors.length + filter.cards.length;
  return (
    <details className="group relative mb-4 inline-block">
      <summary className="cursor-pointer list-none rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium select-none hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900 [&::-webkit-details-marker]:hidden">
        Filter{active && ` · ${count}`} <span aria-hidden="true">▾</span>
      </summary>
      <form
        action="/decks"
        className="absolute z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-paper p-4 shadow-lg dark:border-ink-800 dark:bg-ink-950"
      >
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-500 dark:text-ink-400">
            Casts cards of every colour ticked
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {COLORS.map(({ color, label }) => (
              <label key={color} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="color"
                  value={color}
                  defaultChecked={filter.colors.includes(color)}
                  className="size-4 accent-gold-700"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label
          htmlFor="cards"
          className="mt-4 mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400"
        >
          Card names, separated by semicolons
        </label>
        <input
          id="cards"
          name="cards"
          type="search"
          defaultValue={filter.text}
          placeholder="Llanowar Elves; Shock"
          className="w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
        />
        <div className="mt-4 flex items-center justify-between">
          <Link href="/decks" className="text-sm text-ink-500 hover:underline dark:text-ink-400">
            Clear
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
          >
            Apply
          </button>
        </div>
      </form>
    </details>
  );
}
