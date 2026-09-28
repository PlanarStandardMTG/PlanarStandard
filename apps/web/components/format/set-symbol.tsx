import "keyrune/css/keyrune.min.css";

import { cn } from "@/lib/cn";

/** A set's expansion symbol from keyrune (ADR 014); blank for a code it does not know. */
export function SetSymbol({ code, className }: { code: string; className?: string }) {
  return <i aria-hidden="true" className={cn("ss ss-fw", `ss-${code.toLowerCase()}`, className)} />;
}

/** Every paper card in the set on Scryfall. */
export function scryfallSetSearch(code: string): string {
  const query = new URLSearchParams({
    as: "grid",
    order: "name",
    q: `(game:paper) set:${code.toLowerCase()} prefer:best`,
  });
  return `https://scryfall.com/search?${query.toString()}`;
}
