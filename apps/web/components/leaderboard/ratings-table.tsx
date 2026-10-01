import type { LeaderboardRow, UnrankedPlayerRow } from "@ps/contracts";

import { Placement } from "@/components/ui/marks";
import { cn } from "@/lib/cn";
import { PersonName } from "@/components/ui/person-name";
import { formatDate } from "@/lib/format-date";

/** `rank` is the place on the whole ladder, so a filtered page keeps it. */
export type LadderRow =
  | { readonly rank: number; readonly row: LeaderboardRow }
  | { readonly rank: null; readonly row: UnrankedPlayerRow };

/**
 * The leaderboard's table (E20.12), one page of it at a time, with unranked
 * players after the ranked ones (E20.50). A record, never a percentage — a rate
 * on this page would need `suppress-small-n`, and the record already says
 * everything a rate would.
 */
export function RatingsTable({ rows, caption }: { rows: readonly LadderRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="font-mono text-xs tracking-[0.12em] text-ink-500 uppercase dark:text-ink-400">
          <tr>
            <th scope="col" className="w-20 px-4 py-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Player
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Rating
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Record
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              Matches
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              Events
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-medium md:table-cell">
              Peak
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200 border-t border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {rows.map((entry) => (
            <tr
              key={entry.row.id}
              className={cn("align-middle", entry.rank === 1 && "bg-ink-100 dark:bg-ink-900")}
            >
              <td className="px-2 py-1">
                {entry.rank === null ? (
                  <span className="px-2 font-mono text-xs tracking-[0.12em] text-ink-500 uppercase dark:text-ink-400">
                    Unranked
                  </span>
                ) : (
                  <Placement place={entry.rank} className="text-2xl" />
                )}
              </td>
              <td className="px-4 py-3">
                <PersonName person={{ player: entry.row.slug }} className="text-base font-semibold">
                  {entry.row.displayName}
                </PersonName>
                {entry.row.lastPlayed !== null && (
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    last played {formatDate(entry.row.lastPlayed)}
                  </span>
                )}
              </td>
              {entry.rank === null ? <UnratedCells /> : <RatedCells {...entry} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatedCells({ rank, row }: { rank: number; row: LeaderboardRow }) {
  return (
    <>
      <td
        className={cn(
          "px-4 py-3 text-right font-mono text-lg font-medium",
          rank === 1 && "text-gold-700 dark:text-gold-400",
        )}
      >
        {Math.round(row.rating)}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {row.wins}–{row.losses}
        {row.draws > 0 && `–${row.draws}`}
      </td>
      <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">{row.matchesPlayed}</td>
      <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
        {row.tournamentsPlayed}
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-ink-500 md:table-cell">
        {Math.round(row.peakRating)}
      </td>
    </>
  );
}

/** No rating over these dates, so every column a rating fills is a dash. */
function UnratedCells() {
  const cell = "px-4 py-3 text-right font-mono text-ink-500";
  return (
    <>
      <td className={cell}>—</td>
      <td className={cell}>—</td>
      <td className={cn(cell, "hidden sm:table-cell")}>—</td>
      <td className={cn(cell, "hidden sm:table-cell")}>—</td>
      <td className={cn(cell, "hidden md:table-cell")}>—</td>
    </>
  );
}
