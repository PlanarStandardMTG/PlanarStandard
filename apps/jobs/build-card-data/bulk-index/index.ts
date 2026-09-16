import type { CardDatasetAttribution, IsoDateTime } from "@ps/contracts";

const BULK_INDEX_URL = "https://api.scryfall.com/bulk-data";

/**
 * Scryfall requires both headers on every request and specifically asks that the
 * User-Agent name the application rather than the HTTP library — Node's undici
 * sends its own unless we set one.
 */
export const SCRYFALL_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent":
    "PlanarStandard/0.1 (+https://github.com/planar-standard/planar-standard)",
  Accept: "application/json;q=0.9,*/*;q=0.8",
};

/** Recorded in `meta.json`, because their terms require the data to carry credit. */
export const SCRYFALL_ATTRIBUTION: CardDatasetAttribution = {
  source: "Scryfall",
  sourceUrl: "https://scryfall.com",
  notice:
    "Card data and images courtesy of Scryfall. Magic: The Gathering is © Wizards of the Coast. " +
    "Scryfall does not endorse this project.",
};

/**
 * `default_cards` is every printing, English where one exists — the set of rows the
 * prune filters by set.
 *
 * Not `oracle_cards`, which carries one printing per oracle id chosen by Scryfall: a
 * card reprinted into the pool from an older set keeps its older printing there, so
 * filtering it by set silently loses cards. Not `all_cards` either — that is the same
 * rows in every language, five times the bytes for nothing.
 */
export const BULK_TYPE = "default_cards";

export type BulkSource = {
  /** Points at data.scryfall.io, a CDN — gzipped JSONL, not a JSON array. */
  readonly url: string;
  /** `meta.json` records this as the dataset's provenance (E4.4). */
  readonly updatedAt: IsoDateTime;
  readonly compressedSize: number;
};

/**
 * Pick the bulk entry to download out of the index response.
 *
 * Throws rather than falling back. The plan was written when this endpoint served
 * `download_uri` and a type called "all-printings"; both have since changed, and a
 * silent fallback would have turned that into a quietly wrong dataset instead of a
 * failed build.
 */
export function selectBulkSource(
  body: unknown,
  type: string = BULK_TYPE,
): BulkSource {
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error("bulk index: expected an object with a `data` array");
  }

  const entries = (body as { data: readonly unknown[] }).data;
  const entry = entries.find(
    (candidate): candidate is Record<string, unknown> =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { type?: unknown }).type === type,
  );

  if (entry === undefined) {
    const available = entries
      .map((candidate) => (candidate as { type?: unknown })?.type)
      .filter((name): name is string => typeof name === "string");
    throw new Error(
      `bulk index: no \`${type}\` entry. Available: ${available.join(", ") || "none"}`,
    );
  }

  const url = entry["jsonl_download_uri"];
  const updatedAt = entry["updated_at"];
  const compressedSize = entry["compressed_size"];

  if (typeof url !== "string") {
    throw new Error(`bulk index: \`${type}\` has no \`jsonl_download_uri\``);
  }
  if (typeof updatedAt !== "string") {
    throw new Error(
      `bulk index: \`${type}\` has no \`updated_at\` to record as provenance`,
    );
  }

  return {
    url,
    updatedAt: updatedAt as IsoDateTime,
    compressedSize: typeof compressedSize === "number" ? compressedSize : 0,
  };
}

/**
 * One request to the index, then the caller streams one file. That is the whole
 * network budget: Scryfall asks that bulk ingestion never become a request loop.
 */
export async function fetchBulkSource(
  fetchImpl: typeof fetch = fetch,
  type: string = BULK_TYPE,
): Promise<BulkSource> {
  const response = await fetchImpl(BULK_INDEX_URL, {
    headers: { ...SCRYFALL_HEADERS },
  });
  if (!response.ok) {
    throw new Error(`bulk index: ${response.status} ${response.statusText}`);
  }
  return selectBulkSource(await response.json(), type);
}
