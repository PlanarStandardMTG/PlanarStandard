import type { PlayedEntry } from "@ps/db";
import { formatRecord } from "@ps/core";
import type { ReactNode } from "react";

import { DotLeader, Placement } from "@/components/ui/marks";
import { formatDate } from "@/lib/format-date";

/**
 * Events somebody played, newest first: where they finished, their record, and
 * a line of their own for each — which deck, or which version of this one. The
 * event's name links to its page on the platform it ran on.
 */
export function PlayedEvents({
  entries,
  detail,
}: {
  entries: readonly PlayedEntry[];
  detail?: (entry: PlayedEntry) => ReactNode;
}) {
  return (
    <ol className="divide-y divide-ink-200 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
      {entries.map((entry) => (
        <li
          key={`${entry.tournament.id}-${entry.playerId}`}
          className="flex items-center gap-3 px-4 py-2.5"
        >
          {entry.placement === null ? (
            <span className="w-[2.2em] shrink-0" />
          ) : (
            <Placement place={entry.placement} className="text-xl" />
          )}
          <div className="min-w-0">
            {entry.tournament.externalUrl === null ? (
              <span className="font-medium">{entry.tournament.name}</span>
            ) : (
              <a
                href={entry.tournament.externalUrl}
                rel="noreferrer"
                className="font-medium hover:underline"
              >
                {entry.tournament.name}
              </a>
            )}
            {detail !== undefined && (
              <span className="block truncate text-sm text-ink-600 dark:text-ink-400">
                {detail(entry)}
              </span>
            )}
          </div>
          <DotLeader />
          <span className="shrink-0 text-right font-mono text-sm">
            {formatRecord(entry.record)}
            <span className="block text-xs text-ink-500 dark:text-ink-400">
              {formatDate(entry.tournament.eventDate)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
