import type { LeaderboardRow } from "@ps/contracts";

import { Placement } from "@/components/ui/marks";
import { cn } from "@/lib/cn";
import { PersonName } from "@/components/ui/person-name";
import { formatDate } from "@/lib/format-date";

/**
 * The leaderboard's table (E20.12), one page of it at a time. A record,
 * never a percentage — a rate on this page would need `suppress-small-n`, and
 * the record already says everything a rate would.
 */
export function RatingsTable({
  rows,
  caption,
}: {
  /** `rank` is the place on the whole ladder, so a filtered page keeps it. */
  rows: readonly { readonly rank: number; readonly row: LeaderboardRow }[];
  caption: string;
}) {
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
          {rows.map(({ rank, row }) => (
            <tr
              key={row.id}
              className={cn("align-middle", rank === 1 && "bg-ink-100 dark:bg-ink-900")}
            >
              <td className="px-2 py-1">
                <Placement place={rank} className="text-2xl" />
              </td>
              <td className="px-4 py-3">
                <PersonName person={{ player: row.slug }} className="text-base font-semibold">
                  {row.displayName}
                </PersonName>
                {row.lastPlayed !== null && (
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    last played {formatDate(row.lastPlayed)}
                  </span>
                )}
              </td>
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
              <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
                {row.matchesPlayed}
              </td>
              <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
                {row.tournamentsPlayed}
              </td>
              <td className="hidden px-4 py-3 text-right font-mono text-ink-500 md:table-cell">
                {Math.round(row.peakRating)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
