"use client";

import { useEffect, useState } from "react";

import { useHydrated } from "@/components/ui/hydrated";

/** Chrome's install event, which TypeScript's DOM types do not include. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "ps-play-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Offers to install the play app (E26.23): Chrome's own prompt where the browser
 * offers one, and the Share → Add to Home Screen steps on iOS, which has no prompt.
 * Installing matters most on iOS, where it is the only way to get notifications.
 */
export function InstallPrompt() {
  const hydrated = useHydrated();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!hydrated || dismissed || readDismissed() || isStandalone()) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing: it will simply ask again next time.
    }
    setDismissed(true);
  };

  const ios = isIos();
  if (deferred === null && !ios) return null;

  return (
    <aside
      aria-label="Install the app"
      className="rounded-xl border border-gold-500/40 bg-paper p-4 text-sm text-ink-800 dark:bg-ink-900 dark:text-ink-200"
    >
      <p className="font-medium">Add Planar Standard Play to your home screen</p>
      {ios ? (
        <p className="mt-1 text-ink-600 dark:text-ink-400">
          Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. On iPhone that is
          also what lets the app notify you of a new pairing.
        </p>
      ) : (
        <p className="mt-1 text-ink-600 dark:text-ink-400">
          It opens straight to your event, without a browser tab.
        </p>
      )}
      <div className="mt-3 flex gap-3">
        {deferred !== null && (
          <button
            type="button"
            onClick={() => {
              void deferred.prompt();
              setDeferred(null);
            }}
            className="rounded-lg bg-ink-900 px-3 py-1.5 font-medium text-white dark:bg-ink-100 dark:text-ink-900"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1.5 text-ink-600 hover:text-ink-900 dark:text-ink-400"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
