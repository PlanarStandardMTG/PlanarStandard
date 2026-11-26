/**
 * A reader's per-browser choices, kept in `localStorage`. Nothing here is
 * worth an account row: losing one to a private window or cleared site data
 * only puts the default back, so every read and write swallows a storage error.
 */
export interface Preference<T extends string> {
  readonly key: string;
  readonly values: readonly T[];
  readonly fallback: T;
}

export const THEME: Preference<"system" | "light" | "dark"> = {
  key: "ps:theme",
  values: ["light", "system", "dark"],
  fallback: "system",
};

export const BACKDROP_MOTION: Preference<"on" | "off"> = {
  key: "ps:backdrop-motion",
  values: ["on", "off"],
  fallback: "on",
};

export const DECK_LAYOUT: Preference<"text" | "images"> = {
  key: "ps:deck-layout",
  values: ["text", "images"],
  fallback: "text",
};

export const DECK_ORDER: Preference<"name" | "mana-value"> = {
  key: "ps:deck-order",
  values: ["name", "mana-value"],
  fallback: "name",
};

export function readPreference<T extends string>(preference: Preference<T>): T {
  try {
    const stored = localStorage.getItem(preference.key);
    return preference.values.find((value) => value === stored) ?? preference.fallback;
  } catch {
    return preference.fallback;
  }
}

// `storage` only fires in the other tabs, so a write here announces itself too.
export const CHANGED = "ps:preference";

export function writePreference<T extends string>(preference: Preference<T>, value: T) {
  try {
    if (value === preference.fallback) localStorage.removeItem(preference.key);
    else localStorage.setItem(preference.key, value);
  } catch {
    // Unwritable storage: the choice lasts until the page is left.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * Run in `<head>` before first paint, so a stored theme never flashes the
 * system one first, and a stilled backdrop never starts moving. "system" and
 * "on" are no attribute at all; the CSS does the rest.
 */
export const HEAD_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(THEME.key)});if(t==="light"||t==="dark")d.setAttribute("data-theme",t);if(localStorage.getItem(${JSON.stringify(BACKDROP_MOTION.key)})==="off")d.setAttribute("data-backdrop-motion","off")}catch(e){}})()`;

/** What the head script does, for a choice made after load. */
export function applyTheme(theme: (typeof THEME.values)[number]) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function applyBackdropMotion(motion: (typeof BACKDROP_MOTION.values)[number]) {
  if (motion === "on") document.documentElement.removeAttribute("data-backdrop-motion");
  else document.documentElement.setAttribute("data-backdrop-motion", "off");
}
