import type { Color } from "@ps/contracts";
import {
  colorIdentity,
  compareWinRates,
  deckWinRate,
  formatRecord,
  latestVersions,
  matchesDeckFilter,
  type DeckFilter,
  type DeckWinRate,
} from "@ps/core";
import { listBrowsableDecks } from "@ps/db";
import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import { FORMAT_LABELS } from "@/components/decks/format-labels";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cardIndex } from "@/lib/cards/card-index";
import { toResolvedDeck } from "@/lib/decks/deck-view";
import { formatShortDate } from "@/lib/format-date";
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

/** Newest first unless `?sort=win-rate` asks otherwise. */
type Sort = "newest" | "win-rate";

type Browse = DeckFilter & { readonly text: string; readonly sort: Sort };

const all = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** The browser's state as the URL carries it: `?color=W&color=U&cards=Shock;Opt&sort=win-rate&page=2`. */
function readFilter(params: Params): Browse {
  const text = all(params["cards"])[0] ?? "";
  return {
    colors: COLORS.map((c) => c.color).filter((color) => all(params["color"]).includes(color)),
    cards: text
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean),
    text,
    sort: all(params["sort"])[0] === "win-rate" ? "win-rate" : "newest",
  };
}

function pageHref(filter: Browse, page: number, sort: Sort = filter.sort) {
  const query = new URLSearchParams();
  for (const color of filter.colors) query.append("color", color);
  if (filter.text.trim() !== "") query.set("cards", filter.text);
  if (sort !== "newest") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search === "" ? "/decks" : `/decks?${search}`;
}

/** The filter cleared, the sort kept. */
const clearedHref = (filter: Browse) => pageHref({ ...filter, colors: [], cards: [], text: "" }, 1);

/**
 * The Browse tab (E20.40): every public deck at its newest version, narrowed
 * by colour and card name, ten to a page. Cards are not in Postgres, so the
 * filter runs here against the card index rather than in the query. Each deck
 * shows who it is credited to and its record over every version's events,
 * and can be sorted by match win rate (E20.45).
 */
export async function BrowseDecks({ params }: { params: Params }) {
  const filter = readFilter(params);
  const decks = await load(async () => listBrowsableDecks(await createSessionClient()));
  if (!decks.ok) return <ErrorState title="Decks could not be loaded" detail={decks.error} />;

  const index = cardIndex();
  const matching = latestVersions(decks.value).flatMap(({ deck, lineage }) => {
    const resolved = toResolvedDeck(deck);
    return matchesDeckFilter(resolved, index, filter)
      ? [
          {
            deck,
            colors: colorIdentity(resolved, index),
            winRate: deckWinRate(lineage.flatMap((version) => version.records)),
          },
        ]
      : [];
  });
  if (filter.sort === "win-rate") matching.sort((a, b) => compareWinRates(a.winRate, b.winRate));

  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(all(params["page"])[0]) || 1));
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtering = filter.colors.length > 0 || filter.cards.length > 0;

  return (
    <section aria-label="Browse decks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterMenu filter={filter} active={filtering} />
        <nav aria-label="Sort" className="flex items-center gap-1 text-sm">
          <span className="mr-1 text-ink-500 dark:text-ink-400">Sort by</span>
          {(
            [
              ["newest", "Newest"],
              ["win-rate", "Win rate"],
            ] as const
          ).map(([sort, label]) => (
            <Link
              key={sort}
              href={pageHref(filter, 1, sort)}
              aria-current={filter.sort === sort ? "page" : undefined}
              className="rounded-lg px-2.5 py-1 text-ink-600 hover:bg-ink-50 aria-[current=page]:bg-ink-100 aria-[current=page]:font-medium aria-[current=page]:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-900 dark:aria-[current=page]:bg-ink-800 dark:aria-[current=page]:text-ink-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={filtering ? "No deck matches that filter" : "No public decks yet"}>
          {filtering ? (
            <Link href={clearedHref(filter)} className="underline underline-offset-2">
              Clear the filter
            </Link>
          ) : (
            "Public decks will be listed here."
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
            {shown.map(({ deck, colors, winRate }) => (
              <li key={deck.id}>
                {/* The whole row is one link, so the author is plain text: a
                    person's name cannot be a second link inside it. */}
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <ColorPips colors={colors} className="w-12 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
                    <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-x-3">
                      <span className="truncate font-medium">{deck.name}</span>
                      {deck.author !== null && (
                        <span className="truncate text-sm text-ink-500 dark:text-ink-400">
                          by {deck.author.name}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                      <DeckRecord winRate={winRate} />
                      <span>{FORMAT_LABELS[deck.format]}</span>
                      <span className="whitespace-nowrap">{formatShortDate(deck.createdAt)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav
            aria-label="Pages"
            className="mt-4 flex items-center justify-between text-sm text-ink-600 dark:text-ink-400"
          >
            <PageLink href={page > 1 ? pageHref(filter, page - 1) : null}>
              {filter.sort === "newest" ? "← Newer" : "← Previous"}
            </PageLink>
            <span>
              Page {page} of {pages} · {matching.length} {matching.length === 1 ? "deck" : "decks"}
            </span>
            <PageLink href={page < pages ? pageHref(filter, page + 1) : null}>
              {filter.sort === "newest" ? "Older →" : "Next →"}
            </PageLink>
          </nav>
        </>
      )}
    </section>
  );
}

/**
 * The record only (E20.45): the rate orders the win-rate sort but is never
 * shown. A deck never played at an event shows nothing.
 */
function DeckRecord({ winRate }: { winRate: DeckWinRate }) {
  if (winRate.verdict.n === 0) return null;
  return <span className="whitespace-nowrap">{formatRecord(winRate.record)}</span>;
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
function FilterMenu({ filter, active }: { filter: Browse; active: boolean }) {
  const count = filter.colors.length + filter.cards.length;
  return (
    <details className="group relative inline-block">
      <summary className="cursor-pointer list-none rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium select-none hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900 [&::-webkit-details-marker]:hidden">
        Filter{active && ` · ${count}`} <span aria-hidden="true">▾</span>
      </summary>
      <form
        action="/decks"
        className="absolute z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-paper p-4 shadow-lg dark:border-ink-800 dark:bg-ink-950"
      >
        {filter.sort !== "newest" && <input type="hidden" name="sort" value={filter.sort} />}
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
          <Link
            href={clearedHref(filter)}
            className="text-sm text-ink-500 hover:underline dark:text-ink-400"
          >
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
