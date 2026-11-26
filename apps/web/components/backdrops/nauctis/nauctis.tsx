"use client";

import { ShaderBackdrop, type Scene } from "../shader-backdrop";
import styles from "./nauctis.module.css";
import { FRAGMENT } from "./shader";

/** Seconds for the water to rise from the bottom of the screen to past the top. */
const DURATION_SECONDS = 360;

const scene: Scene = {
  fragment: FRAGMENT,
  // Falling rain needs a smoother frame rate than the other backdrops.
  fps: 30,
  style: {
    uRain: "--nauctis-rain",
    uWater: "--nauctis-water",
    uLight: "--nauctis-light",
    uStrength: "--nauctis-strength",
  },
  start() {
    return (set, { elapsed }) => {
      const progress = Math.min(elapsed / DURATION_SECONDS, 1);
      // Below the screen at first, so it starts as rain alone; past the top, with room for
      // the waves, at the end. Eased in, so it pools before it rises.
      set.float("uLevel", -0.03 + 1.1 * progress ** 1.3);
    };
  },
};

export function NauctisBackdrop() {
  return <ShaderBackdrop scene={scene} className={styles.nauctis} />;
}
