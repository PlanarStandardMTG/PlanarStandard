import { describe, expect, it } from "vitest";

import { checkContactNames } from "./index";

describe("core/auth/contact-names", () => {
  it("keeps an Arena username with its tag, and a Discord name, trimmed", () => {
    expect(
      checkContactNames({ arenaUsername: "  Brayzon#12345 ", discordName: " brayzon " }),
    ).toEqual({ ok: true, arenaUsername: "Brayzon#12345", discordName: "brayzon" });
    expect(checkContactNames({ arenaUsername: "Zaunus 13#40213", discordName: "" })).toMatchObject({
      ok: true,
      arenaUsername: "Zaunus 13#40213",
    });
  });

  it("treats an empty field as none", () => {
    expect(checkContactNames({ arenaUsername: "", discordName: "   " })).toEqual({
      ok: true,
      arenaUsername: null,
      discordName: null,
    });
  });

  it("needs the tag a Direct Challenge needs", () => {
    for (const arenaUsername of ["Brayzon", "Brayzon#", "#12345", "Brayzon#abc"]) {
      expect(checkContactNames({ arenaUsername, discordName: "" })).toEqual({
        ok: false,
        problem: "arena-tag",
      });
    }
  });

  it("refuses anything longer than 64 characters", () => {
    expect(
      checkContactNames({ arenaUsername: `${"a".repeat(60)}#12345`, discordName: "" }),
    ).toEqual({ ok: false, problem: "arena-too-long" });
    expect(checkContactNames({ arenaUsername: "", discordName: "d".repeat(65) })).toEqual({
      ok: false,
      problem: "discord-too-long",
    });
  });
});
