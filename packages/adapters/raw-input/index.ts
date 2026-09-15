// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// What every adapter's `detect` reaches for first.

import type { RawInput } from "@ps/contracts";

const decoder = new TextDecoder("utf-8");

/**
 * The upload as text. `text` is a decode the caller already had, so a paste
 * costs nothing; `bytes` is the authority for an actual file (§9 — adapters do
 * no I/O, the whole file is in hand before `detect` runs).
 */
export function rawText(input: RawInput): string {
  const text = input.text ?? decoder.decode(input.bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** The lower-cased extension with no dot, or `""` for a name that has none. */
export function rawExtension(input: RawInput): string {
  const dot = input.fileName.lastIndexOf(".");
  return dot === -1 ? "" : input.fileName.slice(dot + 1).toLowerCase();
}

/** The declared media type without its parameters, lower-cased. */
export function rawMediaType(input: RawInput): string {
  return (input.mediaType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}
