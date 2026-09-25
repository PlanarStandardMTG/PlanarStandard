import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTournamentList, isMeleeConfigured } from "./client.server";

/**
 * The credentials are production secrets, so every case here is a stub. The
 * point of the module is what it does when melee.gg misbehaves, and that is
 * exactly what a live call would not let us test.
 */
const realFetch = globalThis.fetch;

function tournament(id: number) {
  return { ID: id, Name: `Event ${id}`, StatusDescription: "Registration" };
}

function stubFetch(pages: readonly (readonly unknown[])[]) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const page = Number(new URL(String(input)).searchParams.get("variables.page") ?? "1");
    return new Response(
      JSON.stringify({
        StatusCode: 200,
        Content: pages[page - 1] ?? [],
        HasMore: page < pages.length,
      }),
      { status: 200 },
    );
  }) as typeof globalThis.fetch;
  return calls;
}

beforeEach(() => {
  vi.stubEnv("MELEE_CLIENT_ID", "test-id");
  vi.stubEnv("MELEE_CLIENT_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe("lib/melee/client", () => {
  it("reports not-configured rather than failing when the credentials are absent", async () => {
    vi.stubEnv("MELEE_CLIENT_ID", "");

    expect(isMeleeConfigured()).toBe(false);
    expect(await fetchTournamentList()).toEqual({ status: "not-configured" });
  });

  it("needs the secret as well as the id", async () => {
    vi.stubEnv("MELEE_CLIENT_SECRET", "");

    expect(isMeleeConfigured()).toBe(false);
  });

  it("stops on HasMore rather than inferring the end from a short page", async () => {
    const calls = stubFetch([[tournament(1), tournament(2)]]);

    const result = await fetchTournamentList();

    expect(calls).toHaveLength(1);
    expect(result).toEqual({
      status: "ok",
      payload: { Content: [tournament(1), tournament(2)] },
    });
  });

  it("concatenates pages into one envelope the parser can read", async () => {
    const calls = stubFetch([[tournament(1)], [tournament(2)]]);

    const result = await fetchTournamentList();

    expect(calls).toHaveLength(2);
    expect(result.status === "ok" && (result.payload as { Content: unknown[] }).Content).toEqual([
      tournament(1),
      tournament(2),
    ]);
  });

  it("turns a rate limit into a result, not a throw", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 429 }),
    ) as typeof globalThis.fetch;

    await expect(fetchTournamentList()).resolves.toEqual({
      status: "failed",
      error: "melee responded 429",
    });
  });

  it("treats a failure reported inside a 200 body as a failure", async () => {
    // Otherwise it reads as an empty calendar, and the replace that followed
    // would prune every cached melee.gg event on the strength of an auth error.
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ StatusCode: 401, Content: [] }), { status: 200 }),
    ) as typeof globalThis.fetch;

    await expect(fetchTournamentList()).resolves.toEqual({
      status: "failed",
      error: "melee responded 401 in the payload",
    });
  });

  it("turns a network failure into a result, not a throw", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as typeof globalThis.fetch;

    const result = await fetchTournamentList();

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toContain("fetch failed");
  });

  it("sends the credentials as basic auth against the listing endpoint", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), ...(init === undefined ? {} : { init }) };
      return new Response(JSON.stringify({ StatusCode: 200, Content: [] }), { status: 200 });
    }) as typeof globalThis.fetch;

    await fetchTournamentList();

    const request = seen as unknown as { url: string; init: RequestInit };
    expect(request.url).toContain("https://melee.gg/api/tournament/list");
    expect(request.init.headers).toMatchObject({
      Authorization: `Basic ${btoa("test-id:test-secret")}`,
    });
  });

  it("asks for pages by the names melee honours, a hundred at a time", async () => {
    const calls = stubFetch([[tournament(1)]]);

    await fetchTournamentList();

    const url = new URL(calls[0] ?? "");
    expect(url.searchParams.get("variables.page")).toBe("1");
    expect(url.searchParams.get("variables.pageSize")).toBe("100");
    expect(url.searchParams.has("pageSize")).toBe(false);
  });
});
