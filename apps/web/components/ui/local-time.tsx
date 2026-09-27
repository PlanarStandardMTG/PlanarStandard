"use client";

import { formatDateTime, formatLocalDateTime } from "@/lib/format-date";

import { useHydrated } from "./hydrated";

/**
 * A start time in the reader's own zone. The server renders UTC, which is
 * what the browser hydrates against, and the local time replaces it once the
 * page is live; UTC stays on hover, since the community's schedules are
 * written in it.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated();
  const utc = formatDateTime(iso);

  return (
    <time dateTime={iso} title={utc} className={className}>
      {hydrated ? formatLocalDateTime(iso) : utc}
    </time>
  );
}
