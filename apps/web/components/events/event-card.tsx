import type { ExternalEvent } from "@ps/contracts";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-date";

const STATE_LABELS: Record<ExternalEvent["state"], { label: string; variant: BadgeVariant }> = {
  live: { label: "In progress", variant: "accent" },
  scheduled: { label: "Upcoming", variant: "outline" },
  complete: { label: "Finished", variant: "neutral" },
};

/**
 * One event on the schedule.
 *
 * The whole card is a link out to the event's own page, because that page is the
 * only thing anyone can do here: the site advertises events, Challonge runs
 * them. There is no join and no leave — the previous site had both, wired to a
 * per-user OAuth connection, and neither ever worked well enough to keep.
 */
export function EventCard({ event }: { event: ExternalEvent }) {
  const { label, variant } = STATE_LABELS[event.state];
  const finished = event.state === "complete";

  return (
    <Card className="group transition-colors hover:border-eclipse-500/60 dark:hover:border-eclipse-500/60">
      <article className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={variant}>{label}</Badge>
            {event.structure !== null && (
              <span className="text-xs text-ink-500 capitalize dark:text-ink-400">
                {event.structure}
              </span>
            )}
          </div>

          <h3 className="font-serif text-lg/snug font-semibold tracking-tight">{event.name}</h3>

          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            {event.startsAt === null ? (
              "Date to be announced"
            ) : (
              <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
            )}
            {event.participantCount > 0 && (
              <>
                {" "}
                · {event.participantCount} {event.participantCount === 1 ? "player" : "players"}
              </>
            )}
          </p>
        </div>

        {event.url !== null ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            {finished ? "Final bracket" : "Event page"} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="shrink-0 text-sm text-ink-400 dark:text-ink-600">No page yet</span>
        )}
      </article>
    </Card>
  );
}
