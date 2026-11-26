"use client";

import { useLayoutEffect } from "react";

import {
  applyBackdropMotion,
  BACKDROP_MOTION,
  readPreference,
  writePreference,
} from "@/lib/preferences";
import { usePreference } from "@/lib/use-preference";

/**
 * Stills the home page backdrop (`components/backdrops`); the head script
 * applies a stored choice. The footer is the layout's, so it shows only while
 * a backdrop is on the page.
 */
export function MotionToggle() {
  const motion = usePreference(BACKDROP_MOTION);

  // Read from storage, not `motion`: see `ThemeToggle`.
  useLayoutEffect(() => applyBackdropMotion(readPreference(BACKDROP_MOTION)), [motion]);

  return (
    <label className="hidden cursor-pointer [:root:has([data-backdrop])_&]:flex rounded-lg border border-ink-300 p-0.5 has-focus-visible:outline-2 has-focus-visible:outline-eclipse-500 dark:border-ink-700">
      <input
        type="checkbox"
        checked={motion === "on"}
        onChange={(event) => writePreference(BACKDROP_MOTION, event.target.checked ? "on" : "off")}
        className="peer sr-only"
      />
      <span className="rounded-md px-2.5 py-1 text-xs text-ink-600 peer-checked:bg-ink-200 peer-checked:font-medium peer-checked:text-ink-900 hover:text-ink-900 dark:text-ink-400 dark:peer-checked:bg-ink-800 dark:peer-checked:text-ink-100 dark:hover:text-ink-100">
        Motion
      </span>
    </label>
  );
}
