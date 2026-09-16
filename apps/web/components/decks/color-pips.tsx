import type { Color } from "@ps/contracts";

import { cn } from "@/lib/cn";

/**
 * A deck's colour identity, as pips.
 *
 * Hand-drawn rather than `mana-font` (ADR 014 allows it, but it is a font and a
 * dependency, and this needs five circles). Pip order is WUBRG — the order the
 * cards themselves are printed in, so a deck reads the same here as on a card.
 *
 * The colours are the card-frame colours everybody who plays this game already
 * reads without a legend. They are pale, so each pip carries a ring to stay
 * visible against both themes, and the group carries a text label for anyone who
 * is not reading the colours at all.
 */
const PIPS: Record<Color, { readonly name: string; readonly className: string }> = {
  W: { name: "white", className: "bg-[#f9f7e8] ring-black/15" },
  U: { name: "blue", className: "bg-[#a9d0ec] ring-black/15" },
  B: { name: "black", className: "bg-[#9e9b9a] ring-black/25" },
  R: { name: "red", className: "bg-[#eb9f82] ring-black/15" },
  G: { name: "green", className: "bg-[#9dc5a1] ring-black/15" },
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
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={`Colours: ${ordered.map((color) => PIPS[color].name).join(", ")}`}
    >
      {ordered.map((color) => (
        <span
          key={color}
          aria-hidden="true"
          className={cn("size-3 rounded-full ring-1 ring-inset", PIPS[color].className)}
        />
      ))}
    </span>
  );
}
