import { formatRecord } from "@ps/core";

import { Placement } from "@/components/ui/marks";
import { PersonName } from "@/components/ui/person-name";
import type { Standing } from "@/lib/tournaments/tournament-view";

import { EntryDeckLink } from "./entry-deck";

/** Final standings, best first: where each player finished, their deck and their record. */
export function StandingsList({ standings }: { standings: readonly Standing[] }) {
  return (
    <ol className="divide-y divide-ink-200 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
      {standings.map((standing) => (
        <li key={standing.playerId} className="flex items-center gap-3 px-4 py-2.5">
          {standing.placement === null ? (
            <span className="w-[2.2em] shrink-0" />
          ) : (
            <Placement place={standing.placement} className="text-xl" />
          )}
          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-6">
            <span className="block truncate font-medium sm:w-48 sm:shrink-0">
              <PersonName person={{ player: standing.playerId }}>{standing.name}</PersonName>
              {standing.dropped && (
                <span className="ml-2 text-xs font-normal text-ink-500 dark:text-ink-400">
                  dropped
                </span>
              )}
            </span>
            <span className="block min-w-0 text-sm">
              {standing.deck === null ? (
                <span className="text-ink-400 dark:text-ink-600">No list</span>
              ) : (
                <EntryDeckLink deck={standing.deck} />
              )}
            </span>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums">
            {formatRecord(standing.record)}
          </span>
        </li>
      ))}
    </ol>
  );
}
