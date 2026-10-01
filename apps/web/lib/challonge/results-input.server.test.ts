import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchChallongeResultsInput } from "./results-input.server";

/**
 * Challonge is stubbed; the handles an account-less name is matched against are
 * real rows in a local Supabase (`pnpm db:start`), skipped without one. The
 * player made here carries a per-run tag and is deleted by id afterwards.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: serviceKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const service = createClient(url, serviceKey);
const tag = String(Date.now()).slice(-8);
const realFetch = globalThis.fetch;
const players: string[] = [];

const participant = (id: string, username: string | null, name: string) => ({
  id,
  type: "participant",
  attributes: { name, username, final_rank: Number(id) - 500 },
});

/** Each endpoint's one page; `realFetch` still reaches Supabase. */
function stubChallonge() {
  const pages: Record<string, unknown> = {
    "/participants.json": [
      participant("501", `pilot-${tag}`, "Jane Doe"),
      participant("505", null, `lantern bearer ${tag}`),
      participant("506", null, `Jane Doe ${tag}`),
    ],
    "/matches.json": [],
    "/16049001.json": { id: "16049001", type: "tournament", attributes: { name: "Monthly" } },
  };
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = new URL(String(input));
    if (!target.hostname.includes("challonge")) return realFetch(input, init);
    const key = Object.keys(pages).find((suffix) => target.pathname.endsWith(suffix));
    const page = Number(target.searchParams.get("page") ?? "1");
    const data = key === undefined ? null : page === 1 ? pages[key] : [];
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  vi.stubEnv("CHALLONGE_API_KEY", "test-key");
  vi.stubEnv("CHALLONGE_COMMUNITY", "planarstandardmtg");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

afterAll(async () => {
  if (players.length > 0) await service.from("players").delete().in("id", players);
});

describe.skipIf(!reachable)("lib/challonge/results-input", () => {
  it("puts an account-less participant under the handle the site knows, and never their name", async () => {
    const handle = `Lantern-Bearer-${tag}`;
    const { data, error } = await service
      .from("players")
      .insert({ display_name: handle, slug: `vitest-${tag}-lantern` })
      .select("id")
      .single();
    if (error !== null) throw new Error(error.message);
    players.push((data as { id: string }).id);
    await service.from("player_identities").insert({
      player_id: (data as { id: string }).id,
      platform: "challonge",
      handle,
      source: "import_inferred",
    });
    stubChallonge();

    const result = await fetchChallongeResultsInput(service, "16049001");
    if (result.status !== "ok") throw new Error(`fetch failed: ${result.status}`);
    const text = new TextDecoder().decode(result.input.bytes);
    const payload = JSON.parse(text) as {
      participants: { id: string; username: string | null; knownAs: string | null }[];
    };

    expect(
      payload.participants.map(({ id, username, knownAs }) => [id, username, knownAs]),
    ).toEqual([
      ["501", `pilot-${tag}`, null],
      ["505", null, handle],
      ["506", null, null],
    ]);
    expect(text).not.toContain("Jane Doe");
    expect(text).not.toContain("lantern bearer");
  });
});
