"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

const PREVIEW_WIDTH = 244;
const PREVIEW_HEIGHT = 340;
const OFFSET = 16;

/**
 * A link to a card that shows the card's image beside the cursor on hover.
 *
 * Only where the device can hover: a tap just follows the link. The preview
 * flips to the cursor's other side near the viewport's edge rather than being
 * clipped, since Scryfall's images are shown whole.
 */
export function CardHoverLink({
  href,
  image,
  className,
  children,
}: {
  href: string;
  image: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  const track = (event: MouseEvent) => {
    const x =
      event.clientX + OFFSET + PREVIEW_WIDTH > window.innerWidth
        ? event.clientX - OFFSET - PREVIEW_WIDTH
        : event.clientX + OFFSET;
    const y = Math.max(
      OFFSET,
      Math.min(event.clientY - PREVIEW_HEIGHT / 2, window.innerHeight - PREVIEW_HEIGHT - OFFSET),
    );
    setAt({ x, y });
  };

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        onMouseEnter={image === null ? undefined : track}
        onMouseMove={image === null ? undefined : track}
        onMouseLeave={() => setAt(null)}
      >
        {children}
      </a>
      {image !== null && at !== null && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          style={{ left: at.x, top: at.y }}
          className="pointer-events-none fixed z-50 hidden rounded-[4.75%/3.5%] shadow-xl [@media(hover:hover)]:block"
        />
      )}
    </>
  );
}
