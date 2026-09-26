import type { Player, PlayerId } from "@ps/contracts";
import { listPlayerMerges, listPlayersByIds, listPlayersForMerging } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { mergeSelected, undoMergeAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Players",
  robots: { index: false, follow: false },
};

/** The grid shows this many; a search narrows it. */
const LIMIT = 300;

const DONE: Readonly<Record<string, string>> = {
  merged: "Merged, and the ladder recomputed.",
  undone: "Merge undone, and the ladder recomputed.",
};

const ERRORS: Readonly<Record<string, string>> = {
  pick: "Tick at least two players and choose which one to keep.",
  "same-player": "A player can’t be merged into themselves.",
  missing: "One of those players no longer exists. Reload and try again.",
  "already-merged": "One of those players has already been merged into someone else.",
  "played-each-other":
    "Those players both played in the same event, so they are two people and can’t be merged.",
  "already-undone": "That merge has already been undone.",
  "since-merged":
    "One of those players has been merged again since, so this merge can’t be undone on its own. Undo the later one first.",
};

const FIELD =
  "rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm focus:border-eclipse-500 " +
  "focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * Every player and the handles they hold, for merging handles that are one
 * person (E20.16). Merging is manual: the only automatic link is an exact
 * normalized handle match at import (E18.3).
 */
export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const search = one("q") ?? "";
  const done = one("done");
  const error = one("error");
  const events = one("events");
  const mergedBefore = Number(one("merged") ?? "0");

  const client = await createSessionClient();
  const [players, merges] = await Promise.all([
    listPlayersForMerging(client, { search, limit: LIMIT }),
    listPlayerMerges(client, 20),
  ]);
  const named = await listPlayersByIds(client, [
    ...new Set(merges.flatMap((merge) => [merge.winnerId, merge.loserId])),
  ]);
  const nameOf = (id: PlayerId) =>
    named.find((player: Player) => player.id === id)?.displayName ?? "unknown player";

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Players</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Every player and the handles they have played under. Imports link a handle to an existing
          player only when it matches exactly, ignoring case and punctuation; merge anything else
          that is the same person here. Their matches stay as they are and the ladder is recomputed.
        </p>
      </header>

      {done !== undefined && DONE[done] !== undefined && (
        <Notice tone="good">
          {DONE[done]}
          {done === "merged" && mergedBefore > 1 && ` (${mergedBefore} players)`}
        </Notice>
      )}
      {error !== undefined && ERRORS[error] !== undefined && (
        <Notice tone="warn">
          {mergedBefore > 0 && `${mergedBefore} merged before this stopped. `}
          {ERRORS[error]}
          {events !== undefined && ` Shared: ${events}.`}
        </Notice>
      )}

      <form method="get" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search players
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Search a name or handle"
          className={`${FIELD} w-full max-w-sm`}
        />
        <button type="submit" className={BUTTON}>
          Search
        </button>
      </form>

      <form action={mergeSelected} className="mt-6">
        <input type="hidden" name="q" value={search} />
        {players.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-400">
            {search === "" ? "No players yet." : `No player matches “${search}”.`}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
                <tr>
                  <th scope="col" className="w-16 px-4 py-2 font-semibold">
                    Merge
                  </th>
                  <th scope="col" className="w-16 px-4 py-2 font-semibold">
                    Keep
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Player
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Handles
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {players.map(({ player, handles, rating, matchesPlayed }) => (
                  <tr key={player.id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        name="merge"
                        value={player.id}
                        aria-label={`Merge ${player.displayName}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="keep"
                        value={player.id}
                        aria-label={`Keep ${player.displayName}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{player.displayName}</span>
                      {player.visibility === "hidden" && (
                        <Badge variant="outline" className="ml-2">
                          Hidden
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-400">
                      {handles.map((h) => (
                        <span key={`${h.platform}:${h.handle}`} className="block">
                          {h.handle} <span className="text-xs text-ink-500">· {h.platform}</span>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {rating === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <>
                          {Math.round(rating)}
                          <span className="block text-xs text-ink-500">
                            {matchesPlayed} matches
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {players.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="grow">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason{" "}
                <span className="font-normal text-ink-500">(optional, kept in the history)</span>
              </label>
              <input
                id="reason"
                name="reason"
                placeholder="Same player on Challonge and melee.gg"
                className={`${FIELD} mt-1.5 w-full`}
              />
            </div>
            <button type="submit" className={BUTTON}>
              Merge ticked players into the kept one
            </button>
          </div>
        )}
        {players.length === LIMIT && (
          <p className="mt-3 text-xs text-ink-500">
            Showing the first {LIMIT}. Search to find anyone further down.
          </p>
        )}
      </form>

      <section className="mt-12">
        <h2 className="mb-4 font-serif text-xl font-semibold tracking-tight">Recent merges</h2>
        {merges.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-400">No merges yet.</p>
        ) : (
          <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
            {merges.map((merge) => (
              <li
                key={merge.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
              >
                <div className="text-sm">
                  <p>
                    <span className="font-medium">{nameOf(merge.loserId)}</span> merged into{" "}
                    <span className="font-medium">{nameOf(merge.winnerId)}</span>
                    {merge.undoneAt !== null && (
                      <Badge variant="outline" className="ml-2">
                        Undone
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {formatDate(merge.createdAt)}
                    {merge.reason !== null && ` · ${merge.reason}`}
                  </p>
                </div>
                {merge.undoneAt === null && (
                  <form action={undoMergeAction}>
                    <input type="hidden" name="id" value={merge.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900"
                    >
                      Undo
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
