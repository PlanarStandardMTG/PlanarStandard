import type { EventPodium as EventPodiumData, PodiumFinish } from "@ps/contracts";
import { formatRecord } from "@ps/core";
import Link from "next/link";

import { ColorPips } from "@/components/decks/color-pips";
import { Card } from "@/components/ui/card";
import { Placement, StarRule } from "@/components/ui/marks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";

/**
 * The decks that finished at the top of the last Monthly with decklists,
 * across the full width of the page (E24.5). A tile links to its deck (E24.6);
 * one without a deck does not link at all rather than to a 404.
 */
export function EventPodium({ podium }: { podium: EventPodiumData }) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-serif text-3xl tracking-tight">
          {podium.externalUrl === null ? (
            podium.name
          ) : (
            <a href={podium.externalUrl} rel="noreferrer" className="hover:underline">
              {podium.name}
            </a>
          )}
        </h2>
        <StarRule />
        <p className="font-mono text-xs tracking-[0.12em] text-ink-500 uppercase dark:text-ink-400">
          Top {podium.finishes.length} ·{" "}
          <time dateTime={podium.date}>{formatDate(podium.date)}</time>
          {podium.playerCount !== null && <> · {podium.playerCount} players</>}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {podium.finishes.map((finish) => (
          <li key={`${finish.placement}-${finish.handle}`}>
            {finish.deckId === null ? (
              <PodiumCard finish={finish} />
            ) : (
              <Link href={`/decks/${finish.deckId}`} className="group block h-full">
                <PodiumCard finish={finish} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PodiumCard({ finish }: { finish: PodiumFinish }) {
  const winner = finish.placement === 1;
  const title = finish.deckName ?? finish.archetype ?? "Unlabelled deck";

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-2 border-t-4 p-4 transition-transform group-hover:-translate-y-0.5",
        winner
          ? "border-t-gold-700 dark:border-t-gold-400"
          : "border-t-ink-900 dark:border-t-ink-600",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Placement place={finish.placement} className="-ml-1.5 text-3xl" />
        {finish.record !== null && (
          <span className="pt-1.5 font-mono text-sm">{formatRecord(finish.record)}</span>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-2 font-serif text-lg/snug break-words" title={title}>
          {title}
        </h3>
        {finish.archetype !== null && finish.archetype !== title && (
          <p className="truncate text-sm text-ink-600 italic dark:text-ink-300">
            {finish.archetype}
          </p>
        )}
        <p className="mt-1 truncate text-sm text-ink-500 dark:text-ink-400">{finish.handle}</p>
      </div>

      <ColorPips colors={finish.colors} className="mt-auto" />
    </Card>
  );
}
