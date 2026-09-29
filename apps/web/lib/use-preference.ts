import { useSyncExternalStore } from "react";

import { CHANGED, readPreference, type Preference } from "./preferences";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * The stored value, kept current across tabs. The server and hydration see the
 * fallback, so whatever depends on a stored value renders only after it is read.
 */
export function usePreference<T extends string>(preference: Preference<T>): T {
  return useSyncExternalStore(
    subscribe,
    () => readPreference(preference),
    () => preference.fallback,
  );
}
