import type { IdentityId, IdentityPlatform, IdentityRef, PlayerId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { normalizeHandle } from "../normalize-handle/index";
import { resolveHandles } from "./index";

const identity = (
  id: string,
  player: string,
  platform: IdentityPlatform,
  raw: string,
): IdentityRef => ({
  id: id as IdentityId,
  playerId: player as PlayerId,
  handle: { platform, raw, normalized: normalizeHandle(raw) },
  source: "import_inferred",
  isPrimary: true,
});

describe("core/identity/resolve-handles", () => {
  it("reuses the platform's own identity on an exact normalized match", () => {
    const known = [identity("i1", "p1", "melee", "Liko RS")];

    expect(resolveHandles("melee", ["liko_rs"], known).resolutions).toEqual([
      { kind: "existing", handle: "liko_rs", identityId: "i1" },
    ]);
  });

  it("attaches to the one player another platform already knows by that handle", () => {
    const known = [identity("i1", "p1", "challonge", "LikoRS")];

    expect(resolveHandles("melee", ["Liko-RS"], known).resolutions).toEqual([
      { kind: "attach", handle: "Liko-RS", playerId: "p1" },
    ]);
  });

  it("prefers the same platform over another, even when both match", () => {
    const known = [
      identity("i1", "p1", "challonge", "LikoRS"),
      identity("i2", "p2", "melee", "likors"),
    ];

    expect(resolveHandles("melee", ["LikoRS"], known).resolutions[0]).toMatchObject({
      kind: "existing",
      identityId: "i2",
    });
  });

  it("attaches once when one player holds the handle on several platforms", () => {
    const known = [
      identity("i1", "p1", "challonge", "LikoRS"),
      identity("i2", "p1", "discord", "likors"),
    ];

    expect(resolveHandles("melee", ["LikoRS"], known).resolutions[0]).toMatchObject({
      kind: "attach",
      playerId: "p1",
    });
  });

  it("creates a new player for a handle nobody has sent", () => {
    expect(resolveHandles("melee", ["Newcomer"], []).resolutions).toEqual([
      { kind: "create", handle: "Newcomer" },
    ]);
  });

  it("never links on similarity — a near miss is a new player", () => {
    const known = [identity("i1", "p1", "challonge", "Liko")];

    expect(resolveHandles("melee", ["LikoRS"], known).resolutions[0]?.kind).toBe("create");
  });

  it("creates rather than guesses when two players hold the handle elsewhere", () => {
    const known = [
      identity("i1", "p1", "challonge", "LikoRS"),
      identity("i2", "p2", "discord", "likors"),
    ];
    const result = resolveHandles("melee", ["LikoRS"], known);

    expect(result.resolutions[0]?.kind).toBe("create");
    expect(result.issues.map((i) => [i.code, i.severity])).toEqual([
      ["ambiguous-handle", "warning"],
    ]);
  });

  it("refuses two handles in one event that normalize alike, rather than making one person of them", () => {
    const result = resolveHandles("melee", ["Liko RS", "liko_rs", "Other"], []);

    expect(result.resolutions.map((r) => r.handle)).toEqual(["Other"]);
    expect(result.issues[0]).toMatchObject({ code: "colliding-handles", severity: "error" });
    expect(result.issues[0]?.message).toContain('"Liko RS" and "liko_rs"');
  });

  it("refuses a handle with nothing to normalize", () => {
    const result = resolveHandles("melee", ["☆☆☆"], []);

    expect(result.resolutions).toEqual([]);
    expect(result.issues[0]?.code).toBe("unnormalizable-handle");
  });

  it("resolves a handle once however many matches it played", () => {
    expect(resolveHandles("melee", ["A", "A", "A"], []).resolutions).toHaveLength(1);
  });
});
