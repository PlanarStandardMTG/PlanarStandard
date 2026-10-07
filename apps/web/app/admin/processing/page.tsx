import { inRatingWindow } from "@ps/core";
import {
  getRatingWindow,
  listFormatVersions,
  listRatingRuns,
  listTournamentCoverage,
} from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { InclusionTable } from "@/components/processing/inclusion-table";
import { RatingWindowForm } from "@/components/processing/rating-window-form";
import { requireRole } from "@/lib/auth/guard";
import { findCardMatches } from "@/lib/decks/match-deck-cards.server";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

import {
  confirmCardMatch,
  include,
  matchCards,
  recheckDeckFormats,
  recomputeNow,
  saveRatingWindow,
  setEventFormats,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data processing",
  robots: { index: false, follow: false },
};

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * What each stored tournament counts towards (E25.3): Elo and card statistics,
 * and the format version it was played in (E25.8).
 * Every tournament from any source, and no external request — fetching is
 * `/admin/fetching`. Elo choices are staged and applied together, so several
 * changes cost one full replay (ADR 004). The dates Elo replays sit above
 * them (E25.6), and decklist lines the card data has learned to read since
 * they were saved below those (E20.56), or that an admin matches by hand (E20.57).
 */
export default async function AdminProcessingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const session = await createSessionClient();
  const service = createServiceRoleClient();
  const [coverage, window, [lastRun], versions, cards] = await Promise.all([
    listTournamentCoverage(session),
    getRatingWindow(session),
    listRatingRuns(service, 1),
    listFormatVersions(session),
    findCardMatches(service),
  ]);
  const waiting = coverage.filter((row) => row.includeInElo !== row.tournament.isRated).length;

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Data processing</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          What each stored tournament counts towards. This page works on the site&rsquo;s own data
          and never calls melee.gg or Challonge — getting an event&rsquo;s results is{" "}
          <Link
            href="/admin/fetching"
            className="text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Event fetching
          </Link>
          . A Monthly starts in both. Elo needs an event&rsquo;s matches, and card statistics its
          decklists. Elo changes wait until you recompute; card statistics are saved as you tick
          them. An event starts in the format version in force and can allow more than one; each
          deck the event made counts in the first of them it is legal in, while a member&rsquo;s own
          deck keeps theirs.
        </p>
      </header>

      {params["done"] === "window" && (
        <Notice tone="good">Time frame saved and ratings recomputed.</Notice>
      )}
      {params["done"] === "recomputed" && (
        <Notice tone="good">
          Ratings recomputed
          {params["changed"] === "0"
            ? "."
            : ` with ${String(params["changed"])} Elo ${params["changed"] === "1" ? "change" : "changes"}.`}
        </Notice>
      )}

      {params["done"] === "matched" && (
        <Notice tone="good">
          {params["lines"] === "1"
            ? "1 decklist line"
            : `${String(params["lines"])} decklist lines`}{" "}
          matched.
        </Notice>
      )}

      {params["done"] === "rechecked" && (
        <Notice tone="good">
          Deck formats rechecked:{" "}
          {params["moved"] === "1" ? "1 deck" : `${String(params["moved"])} decks`} moved.
          {params["none"] !== "0" &&
            ` ${params["none"] === "1" ? "1 deck is" : `${String(params["none"])} decks are`} legal in none of their event’s formats and stay in its first — usually a card that isn’t matched yet.`}
        </Notice>
      )}

      <RatingWindowForm
        key={`${window.from}:${window.until ?? ""}`}
        initial={window}
        save={saveRatingWindow}
      />

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {waiting === 0
              ? "The ladder is up to date"
              : `${waiting} Elo ${waiting === 1 ? "change" : "changes"} waiting`}
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {lastRun === undefined
              ? "Ratings have never been computed."
              : `Last recomputed ${formatDateTime(lastRun.createdAt)}.`}
          </p>
        </div>
        <form action={recomputeNow}>
          <button type="submit" className={BUTTON}>
            Recompute ratings
          </button>
        </form>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Deck formats</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            Each deck an event made counts in the first of the event&rsquo;s formats it is legal in.
            That is decided when the event&rsquo;s formats or decklists change; recheck after
            matching cards or editing a format&rsquo;s rules.
          </p>
        </div>
        <form action={recheckDeckFormats}>
          <button type="submit" className={BUTTON}>
            Recheck deck formats
          </button>
        </form>
      </div>

      {(cards.matches.length > 0 || cards.unmatched.length > 0) && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {cards.matches.length === 0
                ? "Every decklist line the card data can read is matched"
                : `${cards.matches.length} unmatched ${cards.matches.length === 1 ? "card name" : "card names"} can now be matched`}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              A decklist&rsquo;s cards are matched when it is saved, against the card data of the
              time. After a set is added to the card data, this matches the lines that name its
              cards.
            </p>
            {cards.unmatched.length > 0 && (
              <details className="mt-2 text-xs text-ink-600 dark:text-ink-400">
                <summary className="cursor-pointer">
                  {cards.unmatched.length} {cards.unmatched.length === 1 ? "name" : "names"} the
                  card data doesn&rsquo;t know — confirm a suggestion to match a misspelling
                </summary>
                <ul className="mt-2 divide-y divide-ink-100 dark:divide-ink-800">
                  {cards.unmatched.map(({ name, suggestion }) => (
                    <li key={name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                      <span className="min-w-0 flex-1">
                        {name}
                        {suggestion !== null && (
                          <>
                            {" "}
                            <span aria-hidden="true">→</span>{" "}
                            <span className="text-ink-900 dark:text-ink-100">
                              {suggestion.name}?
                            </span>
                          </>
                        )}
                      </span>
                      {suggestion === null ? (
                        <span className="text-ink-500">No close card</span>
                      ) : (
                        <form action={confirmCardMatch}>
                          <input type="hidden" name="name" value={name} />
                          <input type="hidden" name="oracle_id" value={suggestion.oracleId} />
                          <button
                            type="submit"
                            className="rounded-md border border-ink-300 px-2 py-0.5 font-medium text-ink-800 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                          >
                            Match
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {cards.matches.length > 0 && (
            <form action={matchCards}>
              <button type="submit" className={BUTTON}>
                Match cards
              </button>
            </form>
          )}
        </div>
      )}

      {coverage.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-400">No tournament is stored yet.</p>
      ) : (
        <InclusionTable
          rows={coverage.map((row) => ({
            id: row.tournament.id,
            name: row.tournament.name,
            href: `/tournaments/${row.tournament.slug}`,
            detail: `${formatDate(row.tournament.eventDate)} · ${
              row.source === null
                ? "Imported"
                : (EVENT_SOURCE_LABELS[row.source as keyof typeof EVENT_SOURCE_LABELS] ??
                  row.source)
            }`,
            stored: `${row.matches} ${row.matches === 1 ? "match" : "matches"} · ${row.decks} of ${row.entries} decks`,
            rateable: row.matches > 0,
            elo: row.includeInElo,
            eloWaiting: row.includeInElo !== row.tournament.isRated,
            outsideWindow: !inRatingWindow(row.tournament.eventDate, window),
            hasDecks: row.decks > 0,
            cardStats: row.inCardStats,
            formatVersionIds: row.tournament.formatVersionIds,
          }))}
          formats={versions.map((version) => ({ id: version.id, name: version.name }))}
          include={include}
          setFormat={setEventFormats}
        />
      )}
    </>
  );
}
