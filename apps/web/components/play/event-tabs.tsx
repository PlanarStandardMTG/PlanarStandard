import type { RunRound } from "@ps/contracts";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Event Info, then one tab per round as each is paired, so the event can be read
 * round by round. The tab is in the URL, so a live refresh keeps you where you are.
 */
export function EventTabs({
  eventId,
  rounds,
  titles,
  active,
}: {
  eventId: string;
  rounds: readonly RunRound[];
  titles: ReadonlyMap<number, string>;
  /** Null is Event Info. */
  active: number | null;
}) {
  const tabs = [
    { key: "info", label: "Event Info", href: `/play/events/${eventId}`, on: active === null },
    ...rounds.map((round) => ({
      key: round.id,
      label: titles.get(round.number) ?? `Round ${round.number}`,
      href: `/play/events/${eventId}?round=${round.number}`,
      on: active === round.number,
    })),
  ];

  return (
    <nav
      aria-label="Event"
      className="-mx-4 overflow-x-auto overflow-y-hidden border-b border-ink-200 px-4 dark:border-ink-800"
    >
      <ul className="flex gap-1 whitespace-nowrap">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.on ? "page" : undefined}
              className={cn(
                "-mb-px inline-block border-b-2 px-3 py-2 text-sm",
                tab.on
                  ? "border-gold-500 font-semibold text-ink-900 dark:text-ink-100"
                  : "border-transparent text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
