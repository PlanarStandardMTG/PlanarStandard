import type { Color, FormatVersion } from "@ps/contracts";
import {
  checkDeck,
  colorIdentity,
  compareWinRates,
  deckWinRate,
  formatRecord,
  latestVersions,
  matchesDeckFilter,
  type DeckFilter,
  type DeckWinRate,
} from "@ps/core";
import { getFormatDetail, listBrowsableDecks, listFormatVersions, type DeckEvent } from "@ps/db";
import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import { deckFormatLabel } from "@/components/decks/format-labels";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cardIndex } from "@/lib/cards/card-index";
import { formatRules, toResolvedDeck } from "@/lib/decks/deck-view";
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

/** Which decks a tab lists (E20.55): every one, members' own, or those from events. */
export type DeckScope = "all" | "community" | "tournament";

const NONE_YET: Record<DeckScope, [title: string, detail: string]> = {
  all: ["No public decks yet", "Public decks will be listed here."],
  community: [
    "No community decks yet",
    "Decks members import and make public will be listed here.",
  ],
  tournament: ["No tournament decks yet", "Decks played at events will be listed here."],
};

type Browse = DeckFilter & {
  readonly scope: DeckScope;
  readonly text: string;
  /**
   * The format version decks must be legal in; null when no version exists, and
   * on the Tournament tab, which goes by its events instead.
   */
  readonly legal: string | null;
  /** The version in force, which the URL leaves out. */
  readonly current: string | null;
  /** On the Tournament tab only: the format version its event was played under (E20.62)… */
  readonly eventFormat: string | null;
  /** …and the event itself (E20.61). */
  readonly event: string | null;
  readonly sort: Sort;
};

const all = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * The browser's state as the URL carries it:
 * `?color=W&cards=Shock;Opt&legal=<id>&sort=win-rate&page=2`, and on the
 * Tournament tab `?view=tournament&format=<id>&event=<id>` in place of `legal`.
 */
function readFilter(scope: DeckScope, params: Params): Omit<Browse, "current"> {
  const text = all(params["cards"])[0] ?? "";
  return {
    scope,
    colors: COLORS.map((c) => c.color).filter((color) => all(params["color"]).includes(color)),
    cards: text
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean),
    text,
    legal: scope === "tournament" ? null : all(params["legal"])[0] || null,
    eventFormat: scope === "tournament" ? all(params["format"])[0] || null : null,
    event: scope === "tournament" ? all(params["event"])[0] || null : null,
    sort: all(params["sort"])[0] === "win-rate" ? "win-rate" : "newest",
  };
}

function pageHref(filter: Browse, page: number, sort: Sort = filter.sort) {
  const query = new URLSearchParams();
  if (filter.scope !== "all") query.set("view", filter.scope);
  for (const color of filter.colors) query.append("color", color);
  if (filter.text.trim() !== "") query.set("cards", filter.text);
  if (filter.legal !== filter.current && filter.legal !== null) query.set("legal", filter.legal);
  if (filter.eventFormat !== null) query.set("format", filter.eventFormat);
  if (filter.event !== null) query.set("event", filter.event);
  if (sort !== "newest") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search === "" ? "/decks" : `/decks?${search}`;
}

/** The filter cleared back to the version in force, the tab and the sort kept. */
const clearedHref = (filter: Browse) =>
  pageHref(
    {
      ...filter,
      colors: [],
      cards: [],
      text: "",
      legal: filter.current,
      eventFormat: null,
      event: null,
    },
    1,
  );

/**
 * A member's own import is a community deck; a deck an event made, or one
 * played at an event, is a tournament deck. A member's deck taken to an event
 * is both.
 */
function inScope(
  scope: DeckScope,
  deck: { readonly submittedVia: string | null },
  lineage: readonly { readonly records: readonly unknown[] }[],
): boolean {
  const own = deck.submittedVia === "import";
  if (scope === "community") return own;
  if (scope === "tournament") return !own || lineage.some((version) => version.records.length > 0);
  return true;
}

/**
 * The All, Community and Tournament tabs (E20.40, E20.55): every public deck
 * in the tab at its newest version, narrowed by colour and card name, ten to a
 * page. All and Community list the decks legal in the format version in force,
 * or another one the filter picks (E20.53, E20.60). Tournament goes by its
 * events instead: every format by default, narrowed by the format an event was
 * played under (E20.62) and the event itself (E20.61). Cards are not in Postgres, so the filter runs here against the card
 * index rather than in the query. Each deck shows who it is credited to and its
 * record over every version's events, and can be sorted by match win rate (E20.45).
 *
 * Legality is checked on every request against the version's rules as they are
 * now, whatever format the deck was saved for.
 */
export async function BrowseDecks({ scope, params }: { scope: DeckScope; params: Params }) {
  const asked = readFilter(scope, params);
  const loaded = await load(async () => {
    const client = await createSessionClient();
    const [decks, versions] = await Promise.all([
      listBrowsableDecks(client),
      listFormatVersions(client),
    ]);
    const current = versions.find((version) => version.isCurrent);
    const chosen = versions.find((version) => version.id === asked.legal) ?? current;
    const legalIn =
      scope === "tournament" || chosen === undefined
        ? null
        : await getFormatDetail(client, chosen.id);
    return [decks, versions, legalIn] as const;
  });
  if (!loaded.ok) return <ErrorState title="Decks could not be loaded" detail={loaded.error} />;
  const [decks, versions, legalIn] = loaded.value;

  const index = cardIndex();
  const rules = formatRules(legalIn);
  const candidates = latestVersions(decks).flatMap(({ deck, lineage }) => {
    const resolved = toResolvedDeck(deck);
    return inScope(scope, deck, lineage) &&
      (rules === null || checkDeck(resolved, rules, index).legal)
      ? [{ deck, resolved, events: lineage.flatMap((version) => version.events), lineage }]
      : [];
  });
  // The menus offer only the formats the tab's events were played under, and
  // the events in the format chosen, so a pick never empties the list by
  // itself; anything else in the URL is ignored.
  const tabEvents = scope === "tournament" ? eventsOf(candidates) : [];
  const eventFormats = versions.filter((version) =>
    tabEvents.some((event) => event.formatVersionIds.includes(version.id)),
  );
  const eventFormat = eventFormats.some((version) => version.id === asked.eventFormat)
    ? asked.eventFormat
    : null;
  const events = tabEvents.filter(
    (event) => eventFormat === null || event.formatVersionIds.includes(eventFormat),
  );
  const filter: Browse = {
    ...asked,
    // A version deleted since the link was made falls back to the one in force.
    legal: legalIn?.version.id ?? null,
    current: scope === "tournament" ? null : (versions.find((v) => v.isCurrent)?.id ?? null),
    eventFormat,
    event: events.some((event) => event.id === asked.event) ? asked.event : null,
  };
  const playedAsAsked = (played: readonly DeckEvent[]) =>
    (filter.eventFormat === null && filter.event === null) ||
    played.some(
      (event) =>
        (filter.eventFormat === null || event.formatVersionIds.includes(filter.eventFormat)) &&
        (filter.event === null || event.id === filter.event),
    );
  const matching = candidates.flatMap(({ deck, resolved, events: played, lineage }) =>
    matchesDeckFilter(resolved, index, filter) && playedAsAsked(played)
      ? [
          {
            deck,
            colors: colorIdentity(resolved, index),
            winRate: deckWinRate(lineage.flatMap((version) => version.records)),
          },
        ]
      : [],
  );
  if (filter.sort === "win-rate") matching.sort((a, b) => compareWinRates(a.winRate, b.winRate));

  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(all(params["page"])[0]) || 1));
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtering =
    filter.colors.length > 0 ||
    filter.cards.length > 0 ||
    filter.legal !== filter.current ||
    filter.eventFormat !== null ||
    filter.event !== null;

  return (
    <section aria-label="Browse decks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterMenu
          filter={filter}
          versions={filter.scope === "tournament" ? eventFormats : versions}
          events={events}
          active={filtering}
        />
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
        <EmptyState
          title={
            filtering
              ? "No deck matches that filter"
              : legalIn === null
                ? NONE_YET[filter.scope][0]
                : `No deck here is legal in ${legalIn.version.name} yet`
          }
        >
          {filtering ? (
            <Link href={clearedHref(filter)} className="underline underline-offset-2">
              Clear the filter
            </Link>
          ) : (
            NONE_YET[filter.scope][1]
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
                      <span>{deckFormatLabel(deck, versions)}</span>
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

/** Each event once, latest first. */
function eventsOf(decks: readonly { readonly events: readonly DeckEvent[] }[]): DeckEvent[] {
  const byId = new Map(decks.flatMap(({ events }) => events.map((event) => [event.id, event])));
  return [...byId.values()].sort(
    (a, b) => b.eventDate.localeCompare(a.eventDate) || a.name.localeCompare(b.name),
  );
}

/** A plain GET form in a disclosure, so filtering works without any client script. */
function FilterMenu({
  filter,
  versions,
  events,
  active,
}: {
  filter: Browse;
  versions: readonly FormatVersion[];
  events: readonly DeckEvent[];
  active: boolean;
}) {
  const count =
    filter.colors.length +
    filter.cards.length +
    (filter.legal === filter.current ? 0 : 1) +
    (filter.eventFormat === null ? 0 : 1) +
    (filter.event === null ? 0 : 1);
  return (
    <details className="group relative inline-block">
      <summary className="cursor-pointer list-none rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium select-none hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900 [&::-webkit-details-marker]:hidden">
        Filter{active && ` · ${count}`} <span aria-hidden="true">▾</span>
      </summary>
      <form
        action="/decks"
        className="absolute z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-paper p-4 shadow-lg dark:border-ink-800 dark:bg-ink-950"
      >
        {filter.scope !== "all" && <input type="hidden" name="view" value={filter.scope} />}
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
        {versions.length > 0 && (
          <>
            <label
              htmlFor="format"
              className="mt-4 mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400"
            >
              Format
            </label>
            {/* Tournament filters by the format its events were played under,
                the other tabs by the format a deck is legal in. */}
            <select
              id="format"
              name={filter.scope === "tournament" ? "format" : "legal"}
              defaultValue={
                (filter.scope === "tournament" ? filter.eventFormat : filter.legal) ?? ""
              }
              className="w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
            >
              {filter.scope === "tournament" && <option value="">Any format</option>}
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name}
                  {version.isCurrent && " (current)"}
                </option>
              ))}
            </select>
          </>
        )}
        {filter.scope === "tournament" && events.length > 0 && (
          <>
            <label
              htmlFor="event"
              className="mt-4 mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400"
            >
              Played at
            </label>
            <select
              id="event"
              name="event"
              defaultValue={filter.event ?? ""}
              className="w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
            >
              <option value="">Any event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {formatShortDate(event.eventDate)}
                </option>
              ))}
            </select>
          </>
        )}
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
