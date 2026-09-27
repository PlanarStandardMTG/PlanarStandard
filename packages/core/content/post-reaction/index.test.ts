import { describe, expect, it } from "vitest";

import { POST_REACTIONS, isPostReaction, tallyReactions, toggledReaction } from "./index";

describe("content/post-reaction", () => {
  it("offers a thumbs up, then the colours in WUBRG order", () => {
    expect(POST_REACTIONS).toEqual(["thumbs_up", "white", "blue", "black", "red", "green"]);
  });

  it("narrows an untrusted value", () => {
    expect(isPostReaction("red")).toBe(true);
    expect(isPostReaction("purple")).toBe(false);
    expect(isPostReaction(undefined)).toBe(false);
  });

  it("fills in zeros and drops kinds it does not know", () => {
    expect(
      tallyReactions([
        { reaction: "blue", total: 3 },
        { reaction: "thumbs_up", total: 1 },
        { reaction: "purple", total: 9 },
      ]),
    ).toEqual({ thumbs_up: 1, white: 0, blue: 3, black: 0, red: 0, green: 0 });
  });

  it("takes a reaction back when it is clicked again, and swaps it otherwise", () => {
    expect(toggledReaction(null, "red")).toBe("red");
    expect(toggledReaction("red", "red")).toBeNull();
    expect(toggledReaction("red", "green")).toBe("green");
  });
});
