import type { Color } from "@ps/contracts";

import { cn } from "@/lib/cn";

/**
 * A deck's colour identity, as a ribbon of its colours.
 *
 * Hand-drawn rather than `mana-font` (ADR 014 allows it, but it is a font and a
 * dependency, and this needs five circles). Pip order is WUBRG — the order the
 * cards themselves are printed in, so a deck reads the same here as on a card.
 *
 * The colours are the card-frame colours everybody who plays this game already
 * reads without a legend. The ribbon carries a ring to stay visible against
 * both themes, and a text label for anyone who is not reading the colours at all.
 */
const PIPS: Record<Color, { readonly name: string; readonly className: string }> = {
  W: { name: "white", className: "bg-[#e8dbb0]" },
  U: { name: "blue", className: "bg-[#3e7cc9]" },
  B: { name: "black", className: "bg-[#4a4058]" },
  R: { name: "red", className: "bg-[#d2553a]" },
  G: { name: "green", className: "bg-[#3f8f5a]" },
};

const WUBRG: readonly Color[] = ["W", "U", "B", "R", "G"];

export function ColorPips({ colors, className }: { colors: readonly Color[]; className?: string }) {
  const ordered = WUBRG.filter((color) => colors.includes(color));

  if (ordered.length === 0) {
    return (
      <span className={cn("text-xs text-ink-500 dark:text-ink-400", className)}>Colourless</span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-1.5 w-20 overflow-hidden rounded-full ring-1 ring-ink-950/10 dark:ring-ink-100/15",
        className,
      )}
      aria-label={`Colours: ${ordered.map((color) => PIPS[color].name).join(", ")}`}
    >
      {ordered.map((color) => (
        <span key={color} aria-hidden="true" className={cn("flex-1", PIPS[color].className)} />
      ))}
    </span>
  );
}
