import { EMBED_REGISTRY } from "@ps/core";
import { describe, expect, it } from "vitest";

import { EMBED_RENDERERS } from "./renderers";

describe("EMBED_RENDERERS", () => {
  it("has a renderer for every live component, and none for anything else", () => {
    expect(Object.keys(EMBED_RENDERERS).sort()).toStrictEqual(
      EMBED_REGISTRY.map((embed) => embed.name).sort(),
    );
  });

  it("renders inside a sentence exactly the components core lets sit there", () => {
    for (const embed of EMBED_REGISTRY) {
      const renderers: Readonly<Record<string, { RenderInline?: unknown }>> = EMBED_RENDERERS;
      expect(renderers[embed.name]?.RenderInline !== undefined, embed.name).toBe(embed.inline);
    }
  });
});
