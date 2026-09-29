import { describe, expect, it } from "vitest";

import { POST_REACTIONS, isPostReaction, tallyReactions, toggledReaction } from "./index";

describe("content/post-reaction", () => {
  it("offers a thumbs up alone", () => {
    expect(POST_REACTIONS).toEqual(["thumbs_up"]);
  });

  it("narrows an untrusted value, refusing the retired colours", () => {
    expect(isPostReaction("thumbs_up")).toBe(true);
    expect(isPostReaction("red")).toBe(false);
    expect(isPostReaction(undefined)).toBe(false);
  });

  it("fills in zeros and drops kinds it does not know", () => {
    expect(
      tallyReactions([
        { reaction: "blue", total: 3 },
        { reaction: "thumbs_up", total: 1 },
      ]),
    ).toEqual({ thumbs_up: 1 });
    expect(tallyReactions([])).toEqual({ thumbs_up: 0 });
  });

  it("takes a reaction back when it is clicked again", () => {
    expect(toggledReaction(null, "thumbs_up")).toBe("thumbs_up");
    expect(toggledReaction("thumbs_up", "thumbs_up")).toBeNull();
  });
});
