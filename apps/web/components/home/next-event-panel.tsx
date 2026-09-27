import Link from "next/link";
import type { ExternalEvent } from "@ps/contracts";

import { EventCarousel } from "@/components/home/event-carousel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/ui/local-time";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";

/**
 * The home page's second tile: the next few events worth turning up to, one to
 * a slide (E16.15), and the full schedule under them whichever is in view.
 *
 * Which events those are belongs to `core/events/event-schedule`, not here. What is
 * decided here is only how they read — and the deliberate part is that the
 * platform is a footnote. An event on melee.gg and an event on Challonge are the
 * same thing to a player choosing what to enter, so the source is a small label
 * next to the link rather than a category the page is organised by.
 */
export function NextEventPanel({ events }: { events: readonly ExternalEvent[] }) {
  const [first] = events;
  if (first === undefined) {
    return (
      <Card className="flex h-full flex-col justify-center p-6 text-center sm:p-7">
        <p className="font-medium text-ink-700 dark:text-ink-300">Nothing scheduled</p>
        <p className="mx-auto mt-2 max-w-60 text-sm text-ink-500 dark:text-ink-400">
          Organisers post new brackets a week or two ahead.
        </p>
        <Link
          href="/events"
          className="mt-4 text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
        >
          The full schedule →
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col border-t-2 border-t-gold-700 dark:border-t-gold-400">
      <EventCarousel
        footer={
          <Link
            href="/events"
            className="py-1 font-medium text-ink-600 hover:text-eclipse-700 dark:text-ink-400 dark:hover:text-eclipse-400"
          >
            The full schedule →
          </Link>
        }
      >
        {events.map((event, i) => (
          <EventSlide key={event.id} event={event} lead={i === 0} />
        ))}
      </EventCarousel>
    </Card>
  );
}

function EventSlide({ event, lead }: { event: ExternalEvent; lead: boolean }) {
  const live = event.state === "live";

  return (
    <article className="group/panel relative flex flex-1 flex-col p-6 sm:p-7">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={live ? "accent" : "outline"}>
          {live ? "Happening now" : lead ? "Up next" : "Coming up"}
        </Badge>
        {event.structure !== null && (
          <span className="text-xs text-ink-500 capitalize dark:text-ink-400">
            {event.structure}
          </span>
        )}
      </div>

      <h2 className="font-display text-2xl/snug tracking-tight text-balance">
        {event.url !== null ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="after:absolute after:inset-0 group-hover/panel:text-eclipse-700 dark:group-hover/panel:text-eclipse-400"
          >
            {event.name}
          </a>
        ) : (
          event.name
        )}
      </h2>

      <p className="mt-2 font-mono text-sm text-ink-600 dark:text-ink-400">
        {event.startsAt === null ? "Date to be announced" : <LocalTime iso={event.startsAt} />}
      </p>

      {event.participantCount > 0 && (
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
          {event.participantCount} {event.participantCount === 1 ? "player" : "players"} entered
        </p>
      )}

      <div className="mt-auto flex items-baseline justify-between gap-3 pt-6 text-sm">
        <span className="text-eclipse-700 group-hover/panel:underline dark:text-eclipse-400">
          {event.url === null ? (
            <span className="text-ink-400 dark:text-ink-600">No page yet</span>
          ) : (
            <>
              {live ? "Follow along" : "Entry and pairings"} <span aria-hidden="true">↗</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-xs text-ink-500 dark:text-ink-400">
          on {EVENT_SOURCE_LABELS[event.source]}
        </span>
      </div>
    </article>
  );
}
