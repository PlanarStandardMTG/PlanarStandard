import Link from "next/link";
import type { ExternalEvent } from "@ps/contracts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate, formatDateTime } from "@/lib/format-date";

/**
 * The home page's second tile: the one event worth turning up to next.
 *
 * Which event that is belongs to `core/events/event-schedule`, not here. What is
 * decided here is only how it reads — and the deliberate part is that the
 * platform is a footnote. An event on melee.gg and an event on Challonge are the
 * same thing to a player choosing what to enter, so the source is a small label
 * next to the link rather than a category the page is organised by.
 *
 * `then` is what comes after it, and exists for the same reason the news tile
 * lists the posts behind its lead: one event is not enough to plan around, and
 * on a two-tile row a card with one fact in it leaves a hole.
 */
export function NextEventPanel({
  event,
  then = [],
}: {
  event: ExternalEvent | null;
  then?: readonly ExternalEvent[];
}) {
  if (event === null) {
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

  const live = event.state === "live";

  return (
    <Card className="group/panel flex h-full flex-col transition-colors hover:border-eclipse-500/60 dark:hover:border-eclipse-500/60">
      <article className="relative flex flex-1 flex-col p-6 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={live ? "accent" : "outline"}>{live ? "Happening now" : "Up next"}</Badge>
          {event.structure !== null && (
            <span className="text-xs text-ink-500 capitalize dark:text-ink-400">
              {event.structure}
            </span>
          )}
        </div>

        <h2 className="font-serif text-xl/snug font-semibold tracking-tight text-balance">
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

        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          {event.startsAt === null ? (
            "Date to be announced"
          ) : (
            <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
          )}
        </p>

        {event.participantCount > 0 && (
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            {event.participantCount} {event.participantCount === 1 ? "player" : "players"} entered
          </p>
        )}

        {then.length > 0 && (
          <ul className="mt-6 space-y-px border-t border-ink-200 pt-3 dark:border-ink-800">
            {then.map((later) => (
              <li
                key={later.id}
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
              >
                {/* The column is narrow enough that a long name will clip, so
                    the full one stays reachable on hover. */}
                <span
                  title={later.name}
                  className="min-w-0 truncate text-ink-600 dark:text-ink-400"
                >
                  {later.name}
                </span>
                {later.startsAt !== null && (
                  <time
                    dateTime={later.startsAt}
                    className="shrink-0 text-xs text-ink-500 tabular-nums dark:text-ink-400"
                  >
                    {formatDate(later.startsAt)}
                  </time>
                )}
              </li>
            ))}
          </ul>
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

      {/* Outside the stretched link's article, or it would be unclickable. */}
      <div className="relative z-10 border-t border-ink-200 px-6 py-3 text-sm dark:border-ink-800 sm:px-7">
        <Link
          href="/events"
          className="font-medium text-ink-600 hover:text-eclipse-700 dark:text-ink-400 dark:hover:text-eclipse-400"
        >
          The full schedule →
        </Link>
      </div>
    </Card>
  );
}
