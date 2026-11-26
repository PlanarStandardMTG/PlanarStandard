"use client";

import { ShaderBackdrop, type Scene } from "../shader-backdrop";
import styles from "./fracture.module.css";
import { FRAGMENT } from "./shader";

/** Seconds from untouched glass to every plate at its full drift. */
const DURATION_SECONDS = 300;
/** How far each plate drifts, in plates: 0.2 is a fifth of one plate's width. */
const MAX_SPREAD = 0.2;

const scene: Scene = {
  fragment: FRAGMENT,
  // The plates drift slowly, so a few frames a second is enough.
  fps: 12,
  style: {
    uShade: "--plate-shade",
    uGlint: "--plate-glint",
    uRift: "--plate-rift",
    uStrength: "--plate-strength",
  },
  start(set) {
    set.vec2("uSeed", Math.random() * 100, Math.random() * 100);
    set.float("uMaxSpread", MAX_SPREAD);
    // Where the glass was struck, as fractions of the screen from the left and the top: the
    // hero's open left margin, so the smash is not hidden behind the content.
    const impact = { x: 0.06 + Math.random() * 0.14, y: 0.15 + Math.random() * 0.3 };

    return (set, { elapsed, width, height }) => {
      const side = Math.min(width, height);
      const ix = (impact.x * width) / side;
      const iy = ((1 - impact.y) * height) / side;
      set.vec2("uImpact", ix, iy);
      set.float(
        "uFurthest",
        Math.hypot(Math.max(ix, width / side - ix), Math.max(iy, height / side - iy)),
      );
      set.float("uProgress", Math.min(elapsed / DURATION_SECONDS, 1));
    };
  },
};

export function FractureBackdrop() {
  return <ShaderBackdrop scene={scene} className={styles.fracture} />;
}
