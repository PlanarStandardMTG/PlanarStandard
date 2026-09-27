import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during the server render and hydration, true after — without a set-state in an effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
