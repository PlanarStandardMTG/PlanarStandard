import type { ExternalEvent } from "@ps/contracts";
import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";

import { EventCard } from "./event-card";

/**
 * One block of the schedule. Renders nothing at all when its group is empty —
 * a heading over a blank space reads as a bug, and the page's own empty state
 * covers the case where every group is empty — unless it has an `empty` line to
 * show instead, as a filtered list does.
 */
export function EventGroup({
  title,
  events,
  resultsHref,
  lead,
  empty,
  children,
}: {
  title: string;
  events: readonly ExternalEvent[];
  resultsHref?: (event: ExternalEvent) => string | undefined;
  /** Between the heading and the list — a filter. */
  lead?: ReactNode;
  /** Shown in place of the list when it is empty; without it, an empty group renders nothing. */
  empty?: ReactNode;
  /** Below the list — a pager. */
  children?: ReactNode;
}) {
  if (events.length === 0 && empty === undefined) return null;

  return (
    <section className="mb-10 last:mb-0">
      <SectionHeading>{title}</SectionHeading>
      {lead}
      {events.length === 0 && empty}
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} resultsHref={resultsHref?.(event)} />
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
