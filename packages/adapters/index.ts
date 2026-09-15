// packages/adapters — one file per results source.
// All implement ResultsAdapter from @ps/contracts. All pure:
// RawInput in, ParsedEvent out. See §9 of the master plan.

// Which adapter reads this upload (E12.1)
export { adapterById, defaultRegistry, detectAdapter } from "./registry/index";
export type { RegisteredAdapter } from "./registry/index";

// Sources
export { genericCsv } from "./generic-csv/index";
export { manualEntry } from "./manual-entry/index";

// Shared by the delimited-text sources
export { parseCsv } from "./parse-csv/index";
export type { CsvTable, Delimiter } from "./parse-csv/index";
export { normalizeResult } from "./normalize-result/index";
export type { NormalizedResult, ResultCells } from "./normalize-result/index";
export { rawExtension, rawMediaType, rawText } from "./raw-input/index";
