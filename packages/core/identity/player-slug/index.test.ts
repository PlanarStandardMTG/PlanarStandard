import { describe, expect, it } from "vitest";

import { playerSlug } from "./index";

describe("core/identity/player-slug", () => {
  it("lower-cases and hyphenates a handle", () => {
    expect(playerSlug("Liko RS")).toBe("liko-rs");
    expect(playerSlug("zed_zed")).toBe("zed-zed");
  });

  it("trims and collapses what a URL cannot carry", () => {
    expect(playerSlug("  --Arcane  Owl!!  ")).toBe("arcane-owl");
    expect(playerSlug("adal#11111")).toBe("adal-11111");
  });

  it("falls back to a word when nothing survives", () => {
    expect(playerSlug("☆☆☆")).toBe("player");
  });

  it("numbers a retry from 2", () => {
    expect(playerSlug("Liko RS", 1)).toBe("liko-rs");
    expect(playerSlug("Liko RS", 2)).toBe("liko-rs-2");
  });
});
