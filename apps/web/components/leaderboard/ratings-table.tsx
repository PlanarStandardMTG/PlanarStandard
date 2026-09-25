import type { LeaderboardRow } from "@ps/contracts";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";

/**
 * One table of the leaderboard (E20.12): ranked, or not ranked yet. A record,
 * never a percentage — a rate on this page would need `suppress-small-n`, and
 * the record already says everything a rate would.
 */
export function RatingsTable({
  rows,
  ranked,
  caption,
}: {
  rows: readonly LeaderboardRow[];
  /** Ranked rows are numbered; provisional ones are not, since they hold no place yet. */
  ranked: boolean;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
          <tr>
            {ranked && (
              <th scope="col" className="w-12 px-4 py-2 font-semibold">
                #
              </th>
            )}
            <th scope="col" className="px-4 py-2 font-semibold">
              Player
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              Rating
            </th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">
              Record
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
              Matches
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
              Events
            </th>
            <th scope="col" className="hidden px-4 py-2 text-right font-semibold md:table-cell">
              Peak
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
          {rows.map((row, i) => (
            <tr key={row.id} className="align-middle">
              {ranked && <td className="px-4 py-3 text-ink-500 tabular-nums">{i + 1}</td>}
              <td className="px-4 py-3">
                <span className="font-medium">{row.displayName}</span>
                {!row.isActive && (
                  <Badge variant="outline" className="ml-2">
                    Inactive
                  </Badge>
                )}
                {row.lastPlayed !== null && (
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    last played {formatDate(row.lastPlayed)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {Math.round(row.rating)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.wins}–{row.losses}
                {row.draws > 0 && `–${row.draws}`}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                {row.matchesPlayed}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                {row.tournamentsPlayed}
              </td>
              <td className="hidden px-4 py-3 text-right text-ink-500 tabular-nums md:table-cell">
                {Math.round(row.peakRating)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
