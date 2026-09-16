import type { EventPodium as EventPodiumData, PodiumFinish, WinLossDraw } from "@ps/contracts";

import { ColorPips } from "@/components/decks/color-pips";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-ink-200 pb-2 dark:border-ink-800">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Top {podium.finishes.length} decks
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {podium.name} · <time dateTime={podium.date}>{formatDate(podium.date)}</time>
            {podium.playerCount !== null && <> · {podium.playerCount} players</>}
          </p>
        </div>
        {sample && <Badge variant="outline">Sample data</Badge>}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        "flex h-full flex-col p-5",
        winner && "border-eclipse-500/50 dark:border-eclipse-500/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-serif text-sm font-semibold tabular-nums",
            winner ? "text-eclipse-700 dark:text-eclipse-400" : "text-ink-500 dark:text-ink-400",
          )}
        >
          {ordinal(finish.placement)}
        </span>
        <ColorPips colors={finish.colors} />
      </div>

      <h3 className="mt-3 font-serif text-lg/snug font-semibold tracking-tight">
        {finish.archetype ?? finish.deckName ?? "Unlabelled deck"}
      </h3>

      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
        {finish.handle}
        {finish.record !== null && <> · {formatRecord(finish.record)}</>}
      </p>

      {finish.keyCards.length > 0 && (
        <ul className="mt-auto space-y-0.5 pt-4 text-xs text-ink-500 dark:text-ink-400">
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

/**
 * `5-0`, or `3-1-1` when there were draws.
 *
 * The draw component is dropped when there is nothing in it — whether the source
 * reported a zero or reported nothing at all. `draws` is optional on the contract
 * because plenty of sources report a pair and not a triple, and the difference
 * between the two is not something a reader of this tile needs.
 */
function formatRecord(record: WinLossDraw): string {
  const base = `${record.wins}-${record.losses}`;
  return record.draws === undefined || record.draws === 0 ? base : `${base}-${record.draws}`;
}

function ordinal(placement: number): string {
  const suffix =
    placement % 100 >= 11 && placement % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][placement % 10] ?? "th");
  return `${placement}${suffix}`;
}
