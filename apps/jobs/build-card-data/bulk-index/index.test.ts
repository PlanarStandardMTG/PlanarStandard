import { describe, expect, it } from "vitest";

import {
  BULK_TYPE,
  fetchBulkSource,
  selectBulkSource,
  SCRYFALL_HEADERS,
} from "./index";

/** A real `GET https://api.scryfall.com/bulk-data` response, committed verbatim. */
import bulkIndex from "../../../../fixtures/scryfall/bulk-index.json";

describe("selectBulkSource", () => {
  it("picks default_cards out of the real index response", () => {
    const source = selectBulkSource(bulkIndex);
    expect(source.url).toContain("default-cards");
    expect(source.url.endsWith(".jsonl.gz")).toBe(true);
    expect(source.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(source.compressedSize).toBeGreaterThan(0);
  });

  // The plan called this bulk type "all-printings"; no such type exists.
  it("names the available types when the requested one is absent", () => {
    expect(() => selectBulkSource(bulkIndex, "all-printings")).toThrow(
      /no `all-printings` entry/,
    );
    expect(() => selectBulkSource(bulkIndex, "all-printings")).toThrow(
      /default_cards/,
    );
  });

  // Scryfall serves gzipped JSONL now; `download_uri` is gone.
  it("fails loudly rather than falling back when jsonl_download_uri is missing", () => {
    const body = {
      data: [{ type: BULK_TYPE, updated_at: "2026-09-15T21:01:51.902+00:00" }],
    };
    expect(() => selectBulkSource(body)).toThrow(/no `jsonl_download_uri`/);
  });

  it("refuses an entry with no updated_at, which meta.json needs as provenance", () => {
    const body = {
      data: [
        {
          type: BULK_TYPE,
          jsonl_download_uri: "https://data.scryfall.io/x.jsonl.gz",
        },
      ],
    };
    expect(() => selectBulkSource(body)).toThrow(/no `updated_at`/);
  });

  it.each([[null], [[]], [{}], [{ data: {} }]])(
    "rejects a malformed index body: %j",
    (body) => {
      expect(() => selectBulkSource(body)).toThrow(
        /expected an object with a `data` array/,
      );
    },
  );
});

describe("fetchBulkSource", () => {
  it("sends the User-Agent and Accept headers Scryfall requires", async () => {
    let seen: HeadersInit | undefined;
    await fetchBulkSource((async (_url, init) => {
      seen = init?.headers;
      return { ok: true, json: async () => bulkIndex } as Response;
    }) as typeof fetch);

    expect(seen).toEqual(SCRYFALL_HEADERS);
    expect(SCRYFALL_HEADERS["User-Agent"]).toMatch(/^PlanarStandard\//);
    expect(SCRYFALL_HEADERS["Accept"]).toBeDefined();
  });

  it("makes exactly one request — bulk ingestion is never a request loop", async () => {
    let calls = 0;
    await fetchBulkSource((async () => {
      calls += 1;
      return { ok: true, json: async () => bulkIndex } as Response;
    }) as typeof fetch);

    expect(calls).toBe(1);
  });

  it("surfaces a non-ok response instead of parsing it", async () => {
    const failing = (async () =>
      ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      }) as Response) as typeof fetch;
    await expect(fetchBulkSource(failing)).rejects.toThrow(
      /503 Service Unavailable/,
    );
  });
});
