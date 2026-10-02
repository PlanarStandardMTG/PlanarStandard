/**
 * Carries a visitor's unsaved deck across signing in, so the editor opens with
 * what they were writing.
 *
 * `localStorage`, not `sessionStorage`: a magic link or a sign-up confirmation
 * opens in a new tab, which starts with an empty session store. The draft is
 * taken once and expires, so it never turns up in an unrelated deck later.
 */
export interface HandedDraft {
  readonly name: string;
  readonly visibility: string;
  readonly format: string;
  readonly decklist: string;
}

const KEY = "ps:deck-draft";
export const DRAFT_TTL_MS = 60 * 60 * 1000;

type DraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Storage can be missing or throw (private windows, blocked site data); the hand-off is then skipped. */
function browserStore(): DraftStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function keepDraft(
  draft: HandedDraft,
  store: DraftStore | null = browserStore(),
  now = Date.now(),
): void {
  try {
    store?.setItem(KEY, JSON.stringify({ savedAt: now, draft }));
  } catch {
    // Full or blocked: they sign in and start again, as before.
  }
}

export function takeDraft(
  store: DraftStore | null = browserStore(),
  now = Date.now(),
): HandedDraft | null {
  if (store === null) return null;
  try {
    const raw = store.getItem(KEY);
    store.removeItem(KEY);
    if (raw === null) return null;
    const { savedAt, draft } = JSON.parse(raw) as { savedAt?: unknown; draft?: unknown };
    if (typeof savedAt !== "number" || now - savedAt > DRAFT_TTL_MS) return null;
    return isDraft(draft) ? draft : null;
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is HandedDraft {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  return ["name", "visibility", "format", "decklist"].every(
    (field) => typeof fields[field] === "string",
  );
}
