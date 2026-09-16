import type { IdentityId, PlayerId, SeasonId, TournamentId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import {
  createImport,
  findImportByContentHash,
  listLedgerMatchesBySeason,
  listMatchCorrections,
  listMatchesByTournament,
  listStagedMatches,
  recordMatchCorrection,
  replaceStagedMatches,
  replaceTournamentMatches,
  resolveStagedMatch,
  supersedeOtherImports,
  updateImportStatus,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Everything this suite creates is deleted afterwards **by id** — vitest runs
 * test files in parallel, and a suite that clears a whole table clears it out
 * from under whoever else is using it.
 *
 * Note that half these functions take the service client because they have to:
 * `result_imports` and `staged_matches` have no read policy at all, so the anon
 * client sees an empty result and no error.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/** Its own variable, never the production service-role name — see `repos/events`. */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: anonKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const client = createClient(url, anonKey);
const service = createClient(url, serviceKey);

/** From the seeds. Weekly #40 is rated and `results_imported`; Season II holds it. */
const SEASON_II = "44444444-4444-4444-8444-000000000002" as SeasonId;

const players: string[] = [];
const imports: string[] = [];

async function tournament(slug: string): Promise<TournamentId> {
  const { data } = await service.from("tournaments").select("id").eq("slug", slug).single();
  return (data as { id: string }).id as TournamentId;
}

/**
 * Resolved at module scope, not inside `describe` — its callback is synchronous.
 * Guarded on `reachable`, because with nothing listening these would throw
 * during collection and turn a skip into a failure.
 */
const weekly40 = reachable ? await tournament("planar-standard-weekly-40") : ("" as TournamentId);
const showcase = reachable ? await tournament("community-showcase") : ("" as TournamentId);

/** A player with one Challonge identity, which is what the ledger points at. */
async function makeIdentity(handle: string): Promise<IdentityId> {
  const { data: player, error: playerError } = await service
    .from("players")
    .insert({ display_name: handle, slug: `vitest-results-${handle}-${Date.now()}` })
    .select("id")
    .single();
  if (playerError !== null) throw new Error(`could not create a player: ${playerError.message}`);

  const playerId = (player as { id: string }).id;
  players.push(playerId);

  const { data: identity, error } = await service
    .from("player_identities")
    .insert({
      player_id: playerId,
      platform: "challonge",
      handle: `${handle}-${Date.now()}`,
      source: "import_inferred",
    })
    .select("id, player_id")
    .single();
  if (error !== null) throw new Error(`could not create an identity: ${error.message}`);
  return (identity as { id: string }).id as IdentityId;
}

async function playerOf(identityId: IdentityId): Promise<PlayerId> {
  const { data } = await service
    .from("player_identities")
    .select("player_id")
    .eq("id", identityId)
    .single();
  return (data as { player_id: string }).player_id as PlayerId;
}

async function anImport(over: { contentHash?: string; tournamentId?: TournamentId } = {}) {
  const created = await createImport(service, {
    tournamentId: over.tournamentId ?? weekly40,
    adapterId: "melee-csv",
    contentHash: over.contentHash ?? `hash-${Math.random()}`,
    capabilities: ["matches"],
    fileName: "pairings.csv",
  });
  imports.push(created.id);
  return created;
}

const match = (p1: IdentityId, p2: IdentityId | null, round: number) => ({
  round,
  tableNumber: 1,
  p1IdentityId: p1,
  p2IdentityId: p2,
  p1Games: 2,
  p2Games: p2 === null ? 0 : 1,
  gameDraws: 0,
  result: (p2 === null ? "bye" : "p1_win") as "bye" | "p1_win",
  isElimination: false,
});

describe.skipIf(!reachable)("repos/results", () => {
  afterEach(async () => {
    // Matches before identities: the ledger has no cascade from
    // `player_identities`, which is correct — history is not deletable by accident.
    //
    // By the imports that created them, not by tournament. Test files run in
    // parallel and `repos/ratings` writes matches too; clearing a whole
    // tournament takes another suite's rows with it.
    if (imports.length > 0) await service.from("matches").delete().in("source_import_id", imports);
    if (imports.length > 0) await service.from("result_imports").delete().in("id", imports);
    if (players.length > 0) await service.from("players").delete().in("id", players);
    imports.length = 0;
    players.length = 0;
  });

  it("records an upload and finds it again by its content hash", async () => {
    const created = await anImport({ contentHash: "sha256:abc" });

    expect(created).toMatchObject({
      tournamentId: weekly40,
      adapterId: "melee-csv",
      contentHash: "sha256:abc",
      capabilities: ["matches"],
      status: "uploaded",
    });
    expect((await findImportByContentHash(service, weekly40, "sha256:abc"))?.id).toBe(created.id);
    expect(await findImportByContentHash(service, weekly40, "sha256:nope")).toBeNull();
  });

  it("refuses the same file twice for one event, which is what makes a retry safe", async () => {
    await anImport({ contentHash: "sha256:same" });
    await expect(anImport({ contentHash: "sha256:same" })).rejects.toThrow(/createImport failed/);
  });

  it("lets the same file be imported for a different event", async () => {
    // The hash is scoped to the tournament: one export covering two days is two
    // imports, and neither is a duplicate of the other.
    await anImport({ contentHash: "sha256:shared" });
    const other = await anImport({ contentHash: "sha256:shared", tournamentId: showcase });
    expect(other.tournamentId).toBe(showcase);
  });

  it("moves an import along, recording what each step learned", async () => {
    const created = await anImport();
    await updateImportStatus(service, created.id, "parsed", { rowCount: 42 });
    await updateImportStatus(service, created.id, "committed", {
      committedAt: "2026-09-15T12:00:00.000Z",
    });

    const after = await findImportByContentHash(service, weekly40, created.contentHash);
    expect(after).toMatchObject({ status: "committed", rowCount: 42 });
    expect(after?.committedAt).not.toBeNull();
  });

  it("supersedes prior committed imports without touching the new one", async () => {
    const first = await anImport();
    const second = await anImport();
    await updateImportStatus(service, first.id, "committed");
    await updateImportStatus(service, second.id, "committed");

    expect(await supersedeOtherImports(service, weekly40, second.id)).toBe(1);

    const stale = await findImportByContentHash(service, weekly40, first.contentHash);
    const kept = await findImportByContentHash(service, weekly40, second.contentHash);
    expect(stale?.status).toBe("superseded");
    expect(kept?.status).toBe("committed");
  });

  it("stages a source row with everything needed to re-parse it later", async () => {
    const created = await anImport();
    await replaceStagedMatches(service, created.id, [
      {
        rowIndex: 0,
        raw: { Round: "3", "Player 1": "serlupidus", Result: "???" },
        round: 3,
        p1Handle: "serlupidus",
        p2Handle: "Sunsett",
        result: null,
        issues: [{ code: "unreadable_result", severity: "error", message: "??? is not a result" }],
      },
    ]);

    const [staged] = await listStagedMatches(service, created.id);
    // `raw` is the point: a parser fix re-runs from here, without the file (§26).
    expect(staged?.raw).toEqual({ Round: "3", "Player 1": "serlupidus", Result: "???" });
    // `result` is text, not the enum, so a cell nobody could read still staged.
    expect(staged?.result).toBeNull();
    expect(staged?.issues).toHaveLength(1);
  });

  it("replaces an import's staged rows wholesale on a re-parse", async () => {
    const created = await anImport();
    await replaceStagedMatches(service, created.id, [
      { rowIndex: 0, raw: { a: "1" } },
      { rowIndex: 1, raw: { a: "2" } },
    ]);
    await replaceStagedMatches(service, created.id, [{ rowIndex: 0, raw: { a: "fixed" } }]);

    const staged = await listStagedMatches(service, created.id);
    expect(staged).toHaveLength(1);
    expect(staged[0]?.raw).toEqual({ a: "fixed" });
  });

  it("writes back one side's resolution without disturbing the other", async () => {
    const created = await anImport();
    await replaceStagedMatches(service, created.id, [{ rowIndex: 0, raw: {} }]);
    const [row] = await listStagedMatches(service, created.id);

    const alpha = await makeIdentity("alpha");
    const beta = await makeIdentity("beta");

    await resolveStagedMatch(service, row!.id, {
      p1: { identityId: alpha, method: "exact", confidence: 1 },
      p2: { identityId: beta, method: "trigram", confidence: 0.82 },
    });
    // Re-resolving one side must not discard an operator's choice for the other.
    await resolveStagedMatch(service, row!.id, {
      p1: { identityId: alpha, method: "admin", confidence: 1 },
    });

    const [after] = await listStagedMatches(service, created.id);
    expect(after).toMatchObject({ p1Method: "admin", p2Method: "trigram", p2IdentityId: beta });
    expect(after?.p2Confidence).toBe(0.82);
  });

  it("keeps a staged row's confidence as a number, not a numeric string", async () => {
    const created = await anImport();
    await replaceStagedMatches(service, created.id, [{ rowIndex: 0, raw: {} }]);
    const [row] = await listStagedMatches(service, created.id);
    await resolveStagedMatch(service, row!.id, {
      p1: { identityId: null, method: "none", confidence: 0.5 },
    });

    const [after] = await listStagedMatches(service, created.id);
    expect(typeof after?.p1Confidence).toBe("number");
  });

  it("commits matches and replaces them wholesale on a re-import", async () => {
    const first = await anImport();
    const alpha = await makeIdentity("alpha");
    const beta = await makeIdentity("beta");

    expect(
      await replaceTournamentMatches(service, weekly40, first.id, [
        match(alpha, beta, 1),
        match(alpha, null, 2),
      ]),
    ).toBe(2);

    const second = await anImport();
    expect(
      await replaceTournamentMatches(service, weekly40, second.id, [match(beta, alpha, 1)]),
    ).toBe(1);

    const stored = await listMatchesByTournament(client, weekly40);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.p1IdentityId).toBe(beta);
    expect(stored[0]?.sourceImportId).toBe(second.id);
  });

  it("resolves identities to players for replay, in date-round-id order", async () => {
    const created = await anImport();
    const alpha = await makeIdentity("alpha");
    const beta = await makeIdentity("beta");

    await replaceTournamentMatches(service, weekly40, created.id, [
      match(alpha, beta, 3),
      match(alpha, beta, 1),
      match(alpha, null, 2),
    ]);

    const { matches, unresolved } = await listLedgerMatchesBySeason(client, SEASON_II);

    expect(unresolved).toBe(0);
    expect(matches.map((m) => m.round)).toEqual([1, 2, 3]);
    // ADR 003 in one assertion: the ledger stores identities, this read names
    // players, and that translation is what makes a merge cost no history.
    expect(matches[0]?.p1PlayerId).toBe(await playerOf(alpha));
    expect(matches[1]?.p2PlayerId).toBeNull();
    // `numeric` — a string weight would multiply a rating by NaN.
    expect(typeof matches[0]?.tournamentWeight).toBe("number");
  });

  it("leaves an unrated event's matches out of the replay read", async () => {
    // `community-showcase` is standings-only and unrated (ADR 006). Its matches
    // must not reach a rating even if something managed to write some.
    const created = await anImport({ tournamentId: showcase });
    const alpha = await makeIdentity("alpha");
    const beta = await makeIdentity("beta");
    await replaceTournamentMatches(service, showcase, created.id, [match(alpha, beta, 1)]);

    const { matches } = await listLedgerMatchesBySeason(client, SEASON_II);
    expect(matches).toHaveLength(0);
  });

  it("records a correction with its reason, and refuses one without", async () => {
    const created = await anImport();
    const alpha = await makeIdentity("alpha");
    const beta = await makeIdentity("beta");
    await replaceTournamentMatches(service, weekly40, created.id, [match(alpha, beta, 1)]);
    const [stored] = await listMatchesByTournament(client, weekly40);

    await recordMatchCorrection(service, {
      matchId: stored!.id,
      field: "result",
      oldValue: "p1_win",
      newValue: "p2_win",
      reason: "Organiser confirmed the sheet was entered backwards.",
      correctedBy: "11111111-1111-4111-8111-000000000001",
    });

    // A whitespace reason satisfies `not null` and explains nothing, which
    // defeats the only purpose this table has.
    await expect(
      recordMatchCorrection(service, {
        matchId: stored!.id,
        field: "result",
        oldValue: null,
        newValue: null,
        reason: "   ",
        correctedBy: "11111111-1111-4111-8111-000000000001",
      }),
    ).rejects.toThrow(/requires a reason/);

    const log = await listMatchCorrections(client, stored!.id);
    expect(log).toHaveLength(1);
    expect(log[0]?.reason).toContain("backwards");
  });

  it("keeps staging out of the public client's reach", async () => {
    const created = await anImport();
    await replaceStagedMatches(service, created.id, [{ rowIndex: 0, raw: { secret: "yes" } }]);

    // No read policy at all on either table, so the anon client gets nothing
    // back and no error — which is why every staging function here takes the
    // service client.
    const { data: importRows } = await client.from("result_imports").select("id");
    const { data: stagedRows } = await client.from("staged_matches").select("id");
    expect(importRows).toEqual([]);
    expect(stagedRows).toEqual([]);
  });
});
