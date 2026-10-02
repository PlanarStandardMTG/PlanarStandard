import { describe, expect, it } from "vitest";

import { prepareEmbeds } from "./prepare";

describe("prepareEmbeds", () => {
  it("fences a component line and leaves the rest alone", () => {
    expect(prepareEmbeds('Intro\n:::decklist{id="a_b_c"}\nOutro')).toBe(
      'Intro\n```ps-embed\n:::decklist{id="a_b_c"}\n```\nOutro',
    );
  });

  it("carries an inline component in a code span, within its sentence", () => {
    expect(prepareEmbeds('Cast :::card{name="Opt" inline="true"} first.')).toBe(
      'Cast `` ps-embed::::card{name="Opt" inline="true"} `` first.',
    );
  });

  it("does not touch a line that is already code", () => {
    const shown = '```\n:::decklist{id="a"}\n```';
    expect(prepareEmbeds(shown)).toBe(shown);
  });
});
