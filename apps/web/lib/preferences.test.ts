import { afterEach, describe, expect, it, vi } from "vitest";

import { DECK_LAYOUT, readPreference, THEME, writePreference } from "./preferences";

function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
  return items;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preferences", () => {
  it("reads a stored value", () => {
    stubStorage({ "ps:deck-layout": "images" });
    expect(readPreference(DECK_LAYOUT)).toBe("images");
  });

  it("falls back on a missing or unknown value", () => {
    stubStorage({ "ps:theme": "sepia" });
    expect(readPreference(THEME)).toBe("system");
    expect(readPreference(DECK_LAYOUT)).toBe("text");
  });

  it("falls back when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(readPreference(THEME)).toBe("system");
  });

  it("stores a choice and forgets the fallback, announcing both", () => {
    const items = stubStorage();
    const heard = vi.fn();
    window.addEventListener("ps:preference", heard);

    writePreference(THEME, "dark");
    expect(items.get("ps:theme")).toBe("dark");

    writePreference(THEME, "system");
    expect(items.has("ps:theme")).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
