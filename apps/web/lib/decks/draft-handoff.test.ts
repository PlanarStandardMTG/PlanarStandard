import { describe, expect, it } from "vitest";

import { DRAFT_TTL_MS, keepDraft, takeDraft } from "./draft-handoff";

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    size: () => items.size,
  };
}

const DRAFT = {
  name: "Mono-Green",
  visibility: "unlisted",
  format: "kitchen_table",
  decklist: "4 Llanowar Elves",
};

describe("draft hand-off", () => {
  it("gives back the draft kept before signing in, once", () => {
    const store = memoryStore();
    keepDraft(DRAFT, store, 1_000);
    expect(takeDraft(store, 2_000)).toEqual(DRAFT);
    expect(takeDraft(store, 3_000)).toBeNull();
  });

  it("drops a draft older than the hand-off window", () => {
    const store = memoryStore();
    keepDraft(DRAFT, store, 0);
    expect(takeDraft(store, DRAFT_TTL_MS + 1)).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("ignores anything that isn't a draft", () => {
    const store = memoryStore();
    store.setItem("ps:deck-draft", "not json");
    expect(takeDraft(store)).toBeNull();
    store.setItem("ps:deck-draft", JSON.stringify({ savedAt: Date.now(), draft: { name: 4 } }));
    expect(takeDraft(store)).toBeNull();
  });

  it("does nothing without storage", () => {
    expect(() => keepDraft(DRAFT, null)).not.toThrow();
    expect(takeDraft(null)).toBeNull();
  });
});
