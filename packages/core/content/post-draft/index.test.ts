import { describe, expect, it } from "vitest";

import { defineEmbed } from "../embed-registry/index";
import { TITLE_MAX, checkPostDraft, postSlug, type DraftCheck } from "./index";

const blank = { title: "", subtitle: "", excerpt: "", tags: "", bodyMarkdown: "" };

const deck = defineEmbed<"deck", { id: string }, never>({
  name: "deck",
  label: "Deck",
  description: "",
  attributes: [],
  parse: (raw) =>
    raw["id"] ? { ok: true, value: { id: raw["id"] } } : { ok: false, problem: "needs an id" },
  export: { reddit: () => "", discord: () => "" },
});

function problems(check: DraftCheck): readonly string[] {
  return check.ok ? [] : check.problems.map((p) => `${p.field}:${p.code}`);
}

describe("checkPostDraft", () => {
  it("needs a title even for a draft", () => {
    expect(problems(checkPostDraft(blank, "save", []))).toStrictEqual(["title:empty"]);
  });

  it("saves a draft with an empty body", () => {
    expect(checkPostDraft({ ...blank, title: "Soon" }, "save", []).ok).toBe(true);
  });

  it("refuses to submit an empty body", () => {
    expect(problems(checkPostDraft({ ...blank, title: "Soon" }, "submit", []))).toStrictEqual([
      "body:empty",
    ]);
  });

  it("normalises tags and trims fields to null", () => {
    const check = checkPostDraft(
      { ...blank, title: " A title ", tags: "Season I, meta,  meta ", bodyMarkdown: "Body\r\n" },
      "submit",
      [],
    );
    expect(check).toStrictEqual({
      ok: true,
      draft: {
        title: "A title",
        subtitle: null,
        excerpt: null,
        tags: ["season-i", "meta"],
        bodyMarkdown: "Body",
      },
    });
  });

  it("limits the title and the tags", () => {
    const check = checkPostDraft(
      { ...blank, title: "x".repeat(TITLE_MAX + 1), tags: "a,b,c,d,e,f,no/slash" },
      "save",
      [],
    );
    expect(problems(check)).toStrictEqual(["title:long", "tags:many", "tags:invalid"]);
  });

  it("checks components on submit, not on save", () => {
    const body = ':::deck{}\n\n:::mystery{}\n\n:::deck{id="a"}';
    expect(checkPostDraft({ ...blank, title: "T", bodyMarkdown: body }, "save", [deck]).ok).toBe(
      true,
    );

    const check = checkPostDraft({ ...blank, title: "T", bodyMarkdown: body }, "submit", [deck]);
    expect(check.ok ? [] : check.problems).toStrictEqual([
      { field: "body", code: "bad-embed", detail: "deck: needs an id" },
      { field: "body", code: "unknown-embed", detail: "mystery" },
    ]);
  });
});

describe("postSlug", () => {
  it.each([
    [
      "Why the mono-red mirror is closer than it looks",
      "why-the-mono-red-mirror-is-closer-than-it-looks",
    ],
    ["Séance at Æther Hub!", "seance-at-ther-hub"],
    ["  --Hello,   world--  ", "hello-world"],
    ["!!!", ""],
    ["A writer’s direct post, isn't it", "a-writers-direct-post-isnt-it"],
  ])("%s → %s", (title, slug) => {
    expect(postSlug(title)).toBe(slug);
  });

  it("stays short and never ends on a hyphen", () => {
    const slug = postSlug(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});
