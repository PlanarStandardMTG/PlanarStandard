import type { IdentityId, IdentityPlatform, IdentityRef, PlayerId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { normalizeHandle } from "../normalize-handle/index";
import { knownHandlesForNames } from "./index";

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

const names = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("core/identity/known-handle-for-name", () => {
  it("records a typed name under the same platform's existing handle, in its spelling", () => {
    const known = [identity("i1", "p1", "challonge", "Arcane_Owl")];

    expect(knownHandlesForNames("challonge", [], names({ "505": "arcane owl" }), known)).toEqual(
      new Map([["505", "Arcane_Owl"]]),
    );
  });

  it("falls back to the one player another platform knows by that name", () => {
    const known = [identity("i1", "p1", "melee", "LikoRS")];

    expect(knownHandlesForNames("challonge", [], names({ "505": "Liko RS" }), known)).toEqual(
      new Map([["505", "LikoRS"]]),
    );
  });

  it("leaves a name nobody holds, so the entrant keeps their stand-in", () => {
    const known = [identity("i1", "p1", "challonge", "Arcane_Owl")];

    expect(knownHandlesForNames("challonge", [], names({ "505": "Jane Doe" }), known).size).toBe(0);
  });

  it("does not guess between two players on other platforms", () => {
    const known = [identity("i1", "p1", "melee", "LikoRS"), identity("i2", "p2", "mtgo", "likors")];

    expect(knownHandlesForNames("challonge", [], names({ "505": "LikoRS" }), known).size).toBe(0);
  });

  it("leaves a name whose player is already in the event under an account", () => {
    const known = [
      identity("i1", "p1", "challonge", "pilot-7"),
      identity("i2", "p1", "melee", "Pilot Seven"),
    ];

    expect(
      knownHandlesForNames("challonge", ["pilot-7"], names({ "505": "Pilot Seven" }), known).size,
    ).toBe(0);
  });

  it("leaves a name that collides with another entrant's handle or name", () => {
    const known = [identity("i1", "p1", "challonge", "Arcane_Owl")];

    expect(
      knownHandlesForNames("challonge", ["arcaneowl"], names({ "505": "Arcane Owl" }), known).size,
    ).toBe(0);
    expect(
      knownHandlesForNames(
        "challonge",
        [],
        names({ "505": "Arcane Owl", "506": "arcane-owl" }),
        known,
      ).size,
    ).toBe(0);
  });

  it("leaves both when two names reach one player through different handles", () => {
    const known = [
      identity("i1", "p1", "challonge", "Arcane_Owl"),
      identity("i2", "p1", "melee", "Owlbear"),
    ];

    expect(
      knownHandlesForNames("challonge", [], names({ "505": "Arcane Owl", "506": "Owlbear" }), known)
        .size,
    ).toBe(0);
  });
});
