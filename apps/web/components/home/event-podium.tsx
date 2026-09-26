import type { EventPodium as EventPodiumData, PodiumFinish } from "@ps/contracts";
import { formatRecord } from "@ps/core";

import { ColorPips } from "@/components/decks/color-pips";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Placement, StarRule } from "@/components/ui/marks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";

/**
 * The decks that finished at the top of the last event, across the full width of
 * the page.
 *
 * The tiles do not link anywhere yet. `/decks/[id]` is E20.6 and
 * `/tournaments/[slug]` is E20.14, and a tile that looks clickable and is not —
 * or worse, one linking to a 404 — is a worse first impression than a tile that
 * plainly does not link. `deckId` is already on the contract, so this becomes a
 * link the moment there is somewhere to send the reader.
 */
export function EventPodium({ podium, sample }: { podium: EventPodiumData; sample: boolean }) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-serif text-3xl tracking-tight">{podium.name}</h2>
        <StarRule />
        <p className="font-mono text-xs tracking-[0.12em] text-ink-500 uppercase dark:text-ink-400">
          Top {podium.finishes.length} ·{" "}
          <time dateTime={podium.date}>{formatDate(podium.date)}</time>
          {podium.playerCount !== null && <> · {podium.playerCount} players</>}
        </p>
        {sample && <Badge variant="outline">Sample data</Badge>}
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {podium.finishes.map((finish) => (
          <li key={`${finish.placement}-${finish.handle}`}>
            <PodiumCard finish={finish} />
          </li>
        ))}
      </ul>

      {sample && (
        <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
          Placeholder finishers, drawn from Season II decks — the results ledger they will come from
          is not built yet (E13.8, E24.5). Real standings will replace them without this section
          changing.
        </p>
      )}
    </section>
  );
}

function PodiumCard({ finish }: { finish: PodiumFinish }) {
  const winner = finish.placement === 1;

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-3 border-t-4 p-5",
        winner
          ? "border-t-gold-700 dark:border-t-gold-400"
          : "border-t-ink-900 dark:border-t-ink-600",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Placement place={finish.placement} className="-ml-2 text-4xl" />
        {finish.record !== null && (
          <span className="pt-2 font-mono text-sm">{formatRecord(finish.record)}</span>
        )}
      </div>

      <div>
        <p className="font-semibold">{finish.handle}</p>
        <h3 className="font-serif text-lg/snug text-ink-600 italic dark:text-ink-300">
          {finish.archetype ?? finish.deckName ?? "Unlabelled deck"}
        </h3>
      </div>

      <ColorPips colors={finish.colors} />

      {finish.keyCards.length > 0 && (
        <ul className="mt-auto space-y-0.5 pt-2 text-sm text-ink-600 dark:text-ink-400">
          {finish.keyCards.map((card) => (
            <li key={card} className="truncate">
              {card}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
