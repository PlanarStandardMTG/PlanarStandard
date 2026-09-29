"use client";

import { useLayoutEffect } from "react";

import { applyTheme, readPreference, THEME, writePreference } from "@/lib/preferences";
import { usePreference } from "@/lib/use-preference";

const LABELS = { light: "Light", system: "System", dark: "Dark" } as const;

/**
 * Light, dark, or whatever the reader's system says. The head script in
 * `app/layout.tsx` applies a stored choice before first paint; this applies
 * one made here, and puts the attribute back after the dev-mode remount that
 * clears it.
 */
export function ThemeToggle() {
  const theme = usePreference(THEME);

  // Read from storage, not `theme`: during hydration that is still the
  // fallback, and applying it would flash the system theme.
  useLayoutEffect(() => applyTheme(readPreference(THEME)), [theme]);

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Theme</legend>
      <div className="flex rounded-lg border border-ink-300 p-0.5 dark:border-ink-700">
        {THEME.values.map((value) => (
          <label
            key={value}
            className="cursor-pointer rounded-md px-2.5 py-1 text-xs text-ink-600 hover:text-ink-900 has-checked:bg-ink-200 has-checked:font-medium has-checked:text-ink-900 has-focus-visible:outline-2 has-focus-visible:outline-eclipse-500 dark:text-ink-400 dark:hover:text-ink-100 dark:has-checked:bg-ink-800 dark:has-checked:text-ink-100"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => writePreference(THEME, value)}
              className="sr-only"
            />
            {LABELS[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
