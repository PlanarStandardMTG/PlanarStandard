import type { ExternalEvent } from "@ps/contracts";
import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";

import { EventCard } from "./event-card";

/**
 * One block of the schedule. Renders nothing at all when its group is empty —
 * a heading over a blank space reads as a bug, and the page's own empty state
 * covers the case where every group is empty.
 */
export function EventGroup({
  title,
  events,
  resultsHref,
  children,
}: {
  title: string;
  events: readonly ExternalEvent[];
  resultsHref?: (event: ExternalEvent) => string | undefined;
  /** Below the list — a pager. */
  children?: ReactNode;
}) {
  if (events.length === 0) return null;

  return (
    <section className="mb-10 last:mb-0">
      <SectionHeading>{title}</SectionHeading>
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
