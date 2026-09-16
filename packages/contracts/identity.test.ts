import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Exclusion,
  Handle,
  IdentityRef,
  JsonValue,
  MergeCandidate,
  MergeMoves,
  MergeSuggestion,
  Player,
  PlayerMerge,
  Signal,
} from "./identity";

/** The player_identities generated column, spelled in JS. E9.1 has to agree with this. */
const generatedColumn = (handle: string): string =>
  handle.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

const zaunus = {
  platform: "challonge",
  raw: "Zaunus13 (LikoRS)",
  normalized: "zaunus13likors",
} satisfies Handle;

const liko = {
  platform: "melee",
  raw: "LikoRS",
  normalized: "likors",
} satisfies Handle;

const zaunusIdentity = {
  id: "6f1b0c4e-0b3a-4f6c-9a1d-2c8f5b7e4a01",
  playerId: "b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091",
  handle: zaunus,
  source: "import_inferred",
  isPrimary: true,
} satisfies IdentityRef;

const parenthetical = {
  kind: "parenthetical",
  confidence: 0.95,
  evidence: { handle: "Zaunus13 (LikoRS)", alias: "LikoRS" },
} satisfies Signal;

const coAppearance = {
  identityA: "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
  identityB: "9f8e7d6c-5b4a-4392-8172-6a5b4c3d2e1f",
  reason: "co_appearance",
  tournamentId: "3c9d1e77-8a4b-42f1-9c0d-7e5f6a8b9c01",
} satisfies Exclusion;

describe("identity contracts", () => {
  it("keeps the raw handle next to the normalized form the generated column produces", () => {
    const handles = [
      zaunus,
      liko,
      { platform: "discord", raw: "divnyi (Mika)", normalized: "divnyimika" },
      { platform: "challonge", raw: "c0d33", normalized: "c0d33" },
      { platform: "melee", raw: "Sunsett", normalized: "sunsett" },
    ] satisfies readonly Handle[];

    expectTypeOf(zaunus).toExtend<Handle>();
    for (const handle of handles) {
      expect(generatedColumn(handle.raw)).toBe(handle.normalized);
    }
  });

  it("lets two handles point at one player without rewriting the ledger", () => {
    const merged = [
      zaunusIdentity,
      {
        id: "7c2d1e5f-1a4b-4c8d-b0e2-3f4a5b6c7d02",
        playerId: zaunusIdentity.playerId,
        handle: liko,
        source: "admin_assigned",
        isPrimary: false,
      },
    ] satisfies readonly IdentityRef[];

    expect(merged.map((identity) => identity.playerId)).toEqual([
      zaunusIdentity.playerId,
      zaunusIdentity.playerId,
    ]);
    expect(merged.filter((identity) => identity.isPrimary)).toHaveLength(1);
  });

  it("accepts a signal kind the contract has never heard of", () => {
    const invented = {
      kind: "discord-avatar-hash",
      confidence: 0.42,
      evidence: { hash: "a1b2c3", alsoUsedBy: ["serlupidus"] },
    } satisfies Signal;

    expectTypeOf(invented).toExtend<Signal>();
    expectTypeOf<Signal["kind"]>().toEqualTypeOf<string>();
    expect(invented.kind).not.toBe(parenthetical.kind);
  });

  it("carries the five plan-pinned confidences in one uniform shape", () => {
    const signals = [
      parenthetical,
      {
        kind: "deck-fingerprint",
        confidence: 0.9,
        evidence: { sharedCards: 75, tournaments: ["ps-s2-e7", "ps-s2-e8"] },
      },
      {
        kind: "trigram",
        confidence: 0.6,
        evidence: { a: "sunsett", b: "sunset", similarity: 0.86 },
      },
      {
        kind: "containment",
        confidence: 0.55,
        evidence: { shorter: "liko", longer: "likors" },
      },
      {
        kind: "temporal",
        confidence: 0.3,
        evidence: { aLastEvent: "2025-06-14", bFirstEvent: "2025-07-12" },
      },
    ] satisfies readonly Signal[];

    expect(signals.map((signal) => signal.confidence)).toEqual([0.95, 0.9, 0.6, 0.55, 0.3]);
  });

  it("holds evidence that goes into a jsonb column as-is", () => {
    expectTypeOf<Signal["evidence"]>().toExtend<JsonValue>();
    expectTypeOf<readonly Signal[]>().toExtend<JsonValue>();
    expectTypeOf<MergeSuggestion["evidence"]>().toExtend<JsonValue>();

    expect(JSON.parse(JSON.stringify(parenthetical))).toEqual(parenthetical);
  });

  it("orders exclusion pairs so the identity_a < identity_b check holds", () => {
    expect(coAppearance.identityA < coAppearance.identityB).toBe(true);
    expect(coAppearance.tournamentId).not.toBeNull();
  });

  it("records an admin dismissal, which has no tournament behind it", () => {
    const dismissed = {
      identityA: coAppearance.identityA,
      identityB: coAppearance.identityB,
      reason: "admin_dismissed",
      tournamentId: null,
    } satisfies Exclusion;

    expect(dismissed.tournamentId).toBeNull();
  });

  it("zeroes an excluded candidate however strong its signals are", () => {
    const excluded = {
      playerA: "b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091",
      playerB: "e5f60718-2a3b-4c4d-8e5f-60718293a4b5",
      confidence: 0,
      signals: [parenthetical],
      excludedBy: coAppearance,
    } satisfies MergeCandidate;

    const ranked = [
      {
        playerA: zaunusIdentity.playerId,
        playerB: "c3d4e5f6-7081-4923-ab4c-5d6e7f809102",
        confidence: 0.95,
        signals: [parenthetical],
        excludedBy: null,
      },
      excluded,
    ] satisfies readonly MergeCandidate[];

    expect(excluded.confidence).toBe(0);
    expect(excluded.excludedBy.reason).toBe("co_appearance");
    expect(ranked.map((candidate) => candidate.confidence)).toEqual([0.95, 0]);
  });

  it("mirrors a merge_suggestions row through its review", () => {
    const pending = {
      id: "0d1e2f30-4152-4637-8495-a6b7c8d9e0f1",
      playerA: zaunusIdentity.playerId,
      playerB: "c3d4e5f6-7081-4923-ab4c-5d6e7f809102",
      confidence: 0.95,
      evidence: [parenthetical],
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    } satisfies MergeSuggestion;

    const merged = {
      ...pending,
      status: "merged",
      reviewedBy: "aa11bb22-cc33-4d44-8e55-ff6677889900",
      reviewedAt: "2025-07-19T18:04:00Z",
    } satisfies MergeSuggestion;

    expectTypeOf<MergeSuggestion["status"]>().toEqualTypeOf<
      "pending" | "merged" | "dismissed" | "stale"
    >();
    expect(pending.reviewedBy).toBeNull();
    expect(merged.reviewedBy).not.toBeNull();
    expect(merged.evidence.map((signal) => signal.kind)).toEqual(["parenthetical"]);
  });

  it("closes the status union even though the signal union stays open", () => {
    const rejected = {
      ...({
        id: "0d1e2f30-4152-4637-8495-a6b7c8d9e0f1",
        playerA: zaunusIdentity.playerId,
        playerB: "c3d4e5f6-7081-4923-ab4c-5d6e7f809102",
        confidence: 0.95,
        evidence: [parenthetical],
        reviewedBy: null,
        reviewedAt: null,
      } satisfies Omit<MergeSuggestion, "status">),
      // @ts-expect-error "reviewing" is not one of the four merge_suggestions statuses
      status: "reviewing",
    } satisfies MergeSuggestion;

    expect(rejected.status).toBe("reviewing");
  });

  it("keeps a merged-away player resolvable rather than deleting them", () => {
    const winner = {
      id: zaunusIdentity.playerId,
      displayName: "Zaunus13",
      slug: "zaunus13",
      profileId: null,
      visibility: "public",
      mergedInto: null,
      createdAt: "2025-05-02T10:00:00Z",
    } satisfies Player;

    const loser = {
      ...winner,
      id: "c3d4e5f6-7081-4923-ab4c-5d6e7f809102",
      slug: "likors",
      mergedInto: winner.id,
    } satisfies Player;

    // The leaderboard reads `merged_into is null`, so the loser is absent from
    // it while an old link to their page still resolves.
    expect([winner, loser].filter((player) => player.mergedInto === null)).toEqual([winner]);
  });

  it("records what a merge moved, and nothing the ledger owns", () => {
    const moved = {
      identities: [zaunusIdentity.id],
      entries: ["5e6f7081-92a3-4b4c-8d5e-6f708192a3b4"],
      decks: ["7081a2b3-c4d5-4e6f-9081-a2b3c4d5e6f7"],
    } satisfies MergeMoves;

    const merge = {
      id: "1f2e3d4c-5b6a-4079-8869-5a4b3c2d1e0f",
      winnerId: zaunusIdentity.playerId,
      loserId: "c3d4e5f6-7081-4923-ab4c-5d6e7f809102",
      reason: "same person, two events",
      moved,
      mergedBy: "aa11bb22-cc33-4d44-8e55-ff6677889900",
      createdAt: "2025-07-19T18:06:00Z",
    } satisfies PlayerMerge;

    // ADR 003 and ADR 004, as a type: matches are not moved because they point
    // at identities, and ratings are not moved because they are recomputed.
    expect(Object.keys(merge.moved)).toEqual(["identities", "entries", "decks"]);
    expectTypeOf<MergeMoves>().toExtend<JsonValue>();
    expect(merge.winnerId).not.toBe(merge.loserId);
  });
});
