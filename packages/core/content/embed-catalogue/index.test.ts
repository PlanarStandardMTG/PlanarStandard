import { describe, expect, it } from "vitest";

import { parseEmbedLine } from "../embed-syntax/index";
import { EMBEDS, PLANNED_EMBEDS } from "./index";

describe("the embed catalogue", () => {
  it("never lists a component as both live and planned", () => {
    const live = new Set<string>(EMBEDS.map((embed) => embed.name));
    expect(PLANNED_EMBEDS.filter((planned) => live.has(planned.name))).toStrictEqual([]);
  });

  it("gives every planned component an example the parser reads as itself", () => {
    for (const planned of PLANNED_EMBEDS) {
      expect(parseEmbedLine(planned.example)?.name).toBe(planned.name);
    }
  });

  it("names each component once", () => {
    const names = [...EMBEDS.map((embed) => embed.name), ...PLANNED_EMBEDS.map((p) => p.name)];
    expect(new Set(names).size).toBe(names.length);
  });
});
