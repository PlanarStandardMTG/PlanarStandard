import type { LeaderboardRow } from "@ps/contracts";
import Link from "next/link";
import type { ReactNode } from "react";

import { Placement } from "@/components/ui/marks";
import { cn } from "@/lib/cn";
import { PersonName } from "@/components/ui/person-name";

import { nextSort, type LadderColumn, type LadderRow, type LadderSort } from "./sort-ladder";

/**
 * The leaderboard's table (E20.12), one page of it at a time, with unranked
 * players after the ranked ones (E20.50). A record, never a percentage — a rate
 * on this page would need `suppress-small-n`, and the record already says
 * everything a rate would. Every heading sorts the table (E20.64), and a rank
 * stays the player's place on the ladder whatever it is sorted by.
 */
export function RatingsTable({
  rows,
  caption,
  sort,
  href,
}: {
  rows: readonly LadderRow[];
  caption: string;
  sort: LadderSort;
  href: (sort: LadderSort) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="font-mono text-xs tracking-[0.12em] text-ink-500 uppercase dark:text-ink-400">
          <tr>
            {HEADINGS.map(({ column, label, className }) => (
              <SortHeading
                key={column}
                column={column}
                sort={sort}
                href={href}
                className={className}
              >
                {label}
              </SortHeading>
            ))}
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
              </td>
              {entry.rank === null ? <UnratedCells /> : <RatedCells {...entry} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEADINGS: readonly { column: LadderColumn; label: string; className: string }[] = [
  { column: "rank", label: "Rank", className: "w-20" },
  { column: "player", label: "Player", className: "" },
  { column: "rating", label: "Rating", className: "text-right" },
  { column: "record", label: "Record", className: "text-right" },
  { column: "matches", label: "Matches", className: "hidden text-right sm:table-cell" },
  { column: "events", label: "Events", className: "hidden text-right sm:table-cell" },
  { column: "peak", label: "Peak", className: "hidden text-right md:table-cell" },
];

function SortHeading({
  column,
  sort,
  href,
  className,
  children,
}: {
  column: LadderColumn;
  sort: LadderSort;
  href: (sort: LadderSort) => string;
  className: string;
  children: ReactNode;
}) {
  const active = sort.column === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-4 py-2 font-medium", className)}
    >
      <Link
        href={href(nextSort(sort, column))}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 hover:text-eclipse-700 dark:hover:text-eclipse-400",
          active && "text-ink-900 dark:text-ink-100",
        )}
      >
        {children}
        <span aria-hidden="true" className={cn(!active && "invisible")}>
          {sort.direction === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
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
