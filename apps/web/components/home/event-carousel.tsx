"use client";

import { Children, useRef, useState, type ReactNode } from "react";

/**
 * Slides side by side in a scroll-snapped strip, so a phone swipes them and
 * everything else steps with the arrows or dots. The slides are rendered on
 * the server and arrive as children; only the stepping lives here.
 *
 * `footer` sits under the strip, outside it, sharing a row with the controls,
 * so it shows whichever slide is in view.
 */
export function EventCarousel({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const slides = Children.toArray(children);
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // While an arrow or dot scrolls the strip, the dots hold on its target:
  // following the scroll position would flick back and through every slide on
  // the way. They take the position again once scrolling has settled.
  const target = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (index: number) => {
    const el = strip.current;
    if (el === null) return;
    setActive(index);
    if (index === slideInView(el)) return;
    target.current = index;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  const controls =
    slides.length < 2 ? null : (
      <div className="flex items-center gap-1">
        <StepButton label="Previous event" disabled={active === 0} onClick={() => go(active - 1)}>
          ‹
        </StepButton>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Event ${i + 1} of ${slides.length}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
            className="grid size-6 place-items-center"
          >
            <span
              className={
                i === active
                  ? "size-2 rounded-full bg-gold-700 dark:bg-gold-400"
                  : "size-1.5 rounded-full bg-ink-300 dark:bg-ink-600"
              }
            />
          </button>
        ))}
        <StepButton
          label="Next event"
          disabled={active === slides.length - 1}
          onClick={() => go(active + 1)}
        >
          ›
        </StepButton>
      </div>
    );

  return (
    <>
      <div
        ref={strip}
        role="region"
        aria-roledescription="carousel"
        aria-label="Upcoming events"
        onScroll={(event) => {
          const index = slideInView(event.currentTarget);
          if (target.current === null) setActive(index);
          clearTimeout(settle.current);
          settle.current = setTimeout(() => {
            target.current = null;
            setActive(index);
          }, 150);
        }}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className="flex w-full shrink-0 snap-start"
          >
            {slide}
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-ink-200 px-6 py-2.5 text-sm sm:px-7 dark:border-ink-800">
        {footer}
        {controls}
      </div>
    </>
  );
}

function slideInView(el: HTMLElement): number {
  return Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full text-lg leading-none text-ink-600 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-ink-400 dark:hover:bg-ink-800"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
