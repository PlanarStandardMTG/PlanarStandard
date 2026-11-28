// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E26.21 — a run played on the site, finished and handed to ingest like any source.

import type { ParsedEvent, RawInput, ResultsAdapter } from "@ps/contracts";
import { toParsedEvent, type FinishedRun } from "@ps/core";

import { rawText } from "../raw-input/index";

const ADAPTER_TAG = "site-run";
const VERSION = 1;

/**
 * A finished run as JSON. Ours alone, so it labels itself like `manual-entry`. The
 * bytes are what ingest hashes, so a correction makes a new document and supersedes
 * the last import, and finishing twice unchanged writes nothing (§26).
 */
interface SiteRunDocument extends Omit<FinishedRun, "decklists"> {
  readonly adapter: typeof ADAPTER_TAG;
  readonly version: typeof VERSION;
  readonly decklists: ReadonlyArray<{ readonly entrantId: string; readonly text: string }>;
}

/** The run, ready for `ingestEvent`. `fileName` names it in the import history. */
export function siteRunInput(run: FinishedRun, fileName: string): RawInput {
  const document: SiteRunDocument = {
    adapter: ADAPTER_TAG,
    version: VERSION,
    ...run,
    decklists: [...run.decklists].map(([entrantId, text]) => ({ entrantId, text })),
  };
  const text = JSON.stringify(document);
  return {
    fileName,
    mediaType: "application/json",
    bytes: new TextEncoder().encode(text),
    text,
  };
}

function readDocument(input: RawInput): SiteRunDocument | null {
  try {
    const parsed = JSON.parse(rawText(input)) as Partial<SiteRunDocument> | null;
    if (
      parsed === null ||
      parsed.adapter !== ADAPTER_TAG ||
      parsed.version !== VERSION ||
      typeof parsed.name !== "string" ||
      typeof parsed.date !== "string" ||
      !Array.isArray(parsed.entrants) ||
      !Array.isArray(parsed.rounds) ||
      !Array.isArray(parsed.pairings) ||
      !Array.isArray(parsed.decklists) ||
      parsed.run === undefined
    ) {
      return null;
    }
    return parsed as SiteRunDocument;
  } catch {
    return null;
  }
}

function parse(input: RawInput): ParsedEvent {
  const document = readDocument(input);
  if (document === null) {
    return {
      capabilities: [],
      issues: [
        {
          code: "unreadable-payload",
          severity: "error",
          message: "This is not a finished run from the site.",
        },
      ],
    };
  }
  return toParsedEvent({
    ...document,
    decklists: new Map(document.decklists.map((d) => [d.entrantId, d.text])),
  });
}

export const siteRun: ResultsAdapter = {
  id: ADAPTER_TAG,
  capabilities: ["matches", "standings", "roster", "decklists"],
  detect: (input) => readDocument(input) !== null,
  parse,
};
