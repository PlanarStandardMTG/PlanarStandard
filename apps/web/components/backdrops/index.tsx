import type { ComponentType } from "react";

import { FractureBackdrop } from "./fracture/fracture";
import { GlassBackdrop } from "./glass/glass";
import { NauctisBackdrop } from "./nauctis/nauctis";

/** Every seasonal backdrop, by the name the home page picks it with. */
const BACKDROPS = {
  glass: GlassBackdrop,
  fracture: FractureBackdrop,
  nauctis: NauctisBackdrop,
} satisfies Record<string, ComponentType>;

export type BackdropName = keyof typeof BACKDROPS;

/** A fixed, decorative layer behind the page's content; `null` renders nothing. */
export function Backdrop({ name }: { name: BackdropName | null }) {
  if (name === null) return null;
  const Effect = BACKDROPS[name];
  return (
    <div aria-hidden data-backdrop={name} className="pointer-events-none fixed inset-0 -z-10">
      <Effect />
    </div>
  );
}
