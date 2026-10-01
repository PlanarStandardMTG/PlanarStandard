import "mana-font/css/mana.min.css";

import { cn } from "@/lib/cn";

/**
 * A card's mana cost in mana-font's symbols (ADR 014). A card with two halves
 * shows the front one's, the cost it is usually cast for: `{2}{B} // {B}` is
 * `{2}{B}`. `{W/U}` is mana-font's `ms-wu`, `{2/W}` its `ms-2w`.
 */
export function ManaCost({ cost, className }: { cost: string | null; className?: string }) {
  const front = cost?.split(" // ")[0] ?? "";
  const symbols = front.match(/\{[^}]+\}/g) ?? [];
  if (symbols.length === 0) return null;

  return (
    <span role="img" aria-label={front} className={cn("inline-flex gap-0.5", className)}>
      {symbols.map((symbol, i) => (
        <i
          key={i}
          aria-hidden="true"
          className={`ms ms-cost ms-${symbol.slice(1, -1).replace("/", "").toLowerCase()}`}
        />
      ))}
    </span>
  );
}
