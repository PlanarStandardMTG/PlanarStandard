import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCommunityTournaments, isChallongeConfigured } from "./client.server";

/**
 * The credentials are production secrets, so every case here is a stub. The
 * point of the module is what it does when Challonge misbehaves, and that is
 * exactly what a live call would not let us test.
 */
const realFetch = globalThis.fetch;

function member(id: string) {
  return { id, type: "tournament", attributes: { name: `Event ${id}`, state: "pending" } };
}

function stubFetch(pages: readonly (readonly unknown[])[]) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
    return new Response(JSON.stringify({ data: pages[page - 1] ?? [] }), { status: 200 });
  }) as typeof globalThis.fetch;
  return calls;
}

beforeEach(() => {
  vi.stubEnv("CHALLONGE_API_KEY", "test-key");
  vi.stubEnv("CHALLONGE_COMMUNITY", "planarstandardmtg");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe("lib/challonge/client", () => {
  it("reports not-configured rather than failing when the key is absent", async () => {
    vi.stubEnv("CHALLONGE_API_KEY", "");

    expect(isChallongeConfigured()).toBe(false);
    expect(await fetchCommunityTournaments()).toEqual({ status: "not-configured" });
  });

  it("needs the community as well as the key", async () => {
    vi.stubEnv("CHALLONGE_COMMUNITY", "");

    expect(isChallongeConfigured()).toBe(false);
  });

  it("stops after a short page rather than spending a request to confirm the end", async () => {
    const calls = stubFetch([[member("1"), member("2")]]);

    const result = await fetchCommunityTournaments();

    expect(calls).toHaveLength(1);
    expect(result).toEqual({ status: "ok", payload: { data: [member("1"), member("2")] } });
  });

  it("concatenates full pages into one envelope the parser can read", async () => {
    const full = Array.from({ length: 50 }, (_, i) => member(`p1-${i}`));
    const calls = stubFetch([full, [member("p2-0")]]);

    const result = await fetchCommunityTournaments();

    expect(calls).toHaveLength(2);
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && (result.payload as { data: unknown[] }).data).toHaveLength(51);
  });

  it("turns a rate limit into a result, not a throw", async () => {
    globalThis.fetch = vi.fn(async () => new Response("", { status: 429 })) as typeof globalThis.fetch;

    await expect(fetchCommunityTournaments()).resolves.toEqual({
      status: "failed",
      error: "challonge responded 429",
    });
  });

  it("turns a network failure into a result, not a throw", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as typeof globalThis.fetch;

    const result = await fetchCommunityTournaments();

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toContain("fetch failed");
  });

  it("sends the v1 key headers the v2.1 endpoint expects, against the configured community", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), ...(init === undefined ? {} : { init }) };
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof globalThis.fetch;

    await fetchCommunityTournaments();

    const request = seen as unknown as { url: string; init: RequestInit };
    expect(request.url).toContain("/communities/planarstandardmtg/tournaments.json");
    expect(request.init.headers).toMatchObject({
      "Authorization-Type": "v1",
      Authorization: "test-key",
      // Omitting this is answered with 415, not 401 — observed against the live
      // endpoint while wiring E23.7 up.
      "Content-Type": "application/vnd.api+json",
    });
  });
});
