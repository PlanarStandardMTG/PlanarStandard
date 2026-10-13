"use client";

import { useState } from "react";

/** Copies `text`, for pasting an Arena username into a Direct Challenge (E26.25). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900"
      aria-label={label}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
