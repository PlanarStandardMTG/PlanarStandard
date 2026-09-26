import { ordinal, type SeasonProgress } from "@ps/core";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The small marks the design takes from the logo (`planar-mark.tsx`): its
 * compass star, its ring of stars, and the dots between them.
 */

/** Four long points and four short, as at the centre of the mark. */
function starPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 16 }, (_, k) => {
    const angle = ((k * 22.5 - 90) * Math.PI) / 180;
    const radius = k % 4 === 0 ? r : k % 2 === 0 ? r * 0.42 : r * 0.12;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join(" L")} Z`;
}

const STAR = starPath(12, 12, 12);

export function CompassStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="currentColor" d={STAR} />
    </svg>
  );
}

/**
 * The season as a ring of stars, one lit per week, around the compass star. A
 * season with no end date yet draws a quarter's worth, adding a star a week past it.
 */
export function SeasonRing({
  progress,
  className,
}: {
  progress: SeasonProgress;
  className?: string;
}) {
  const count = progress.weeks ?? Math.max(progress.week, 12);
  return (
    <svg
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={cn("text-gold-700 dark:text-gold-400", className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const angle = ((i * 360) / count - 90) * (Math.PI / 180);
        return (
          <circle
            key={i}
            cx={28 + 24 * Math.cos(angle)}
            cy={28 + 24 * Math.sin(angle)}
            r={i % 3 === 0 ? 3.6 : 2.6}
            className={
              i < progress.week ? "fill-current" : "fill-none stroke-ink-400 dark:stroke-ink-600"
            }
          />
        );
      })}
      <path fill="currentColor" d={starPath(28, 28, 13)} />
    </svg>
  );
}

/** The section divider: a hairline through a few stars. */
export function StarRule({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex min-w-8 flex-1 items-center gap-1.5", className)}>
      <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
      <span className="size-1 rounded-full bg-ink-300 dark:bg-ink-600" />
      <span className="size-1.5 rounded-full bg-ink-400 dark:bg-ink-500" />
      <span className="size-2 rounded-full bg-gold-700 dark:bg-gold-400" />
      <span className="size-1.5 rounded-full bg-ink-400 dark:bg-ink-500" />
      <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
    </span>
  );
}

/** A dotted rule joining a name to its number, as in a printed almanac. */
export function DotLeader() {
  return (
    <span
      aria-hidden="true"
      className="min-w-4 flex-1 -translate-y-1 self-end border-b border-dotted border-ink-300 dark:border-ink-700"
    />
  );
}

/** A small mono label above a heading. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-xs tracking-[0.16em] text-gold-700 uppercase dark:text-gold-400",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A finishing place, set as type; first place carries the compass star. */
export function Placement({ place, className }: { place: number; className?: string }) {
  const first = place === 1;
  return (
    <span
      className={cn(
        "relative inline-flex size-[2.2em] shrink-0 items-center justify-center font-serif italic",
        first ? "text-gold-700 dark:text-gold-400" : "text-ink-600 dark:text-ink-300",
        className,
      )}
    >
      {first && <CompassStar className="absolute inset-0 text-gold-400/25" />}
      <span className="relative">
        {place}
        <span className="text-[0.55em]">{ordinal(place).slice(String(place).length)}</span>
      </span>
    </span>
  );
}
