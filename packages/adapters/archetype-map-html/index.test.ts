import { readFileSync } from "node:fs";
import type { RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { archetypeMapHtml } from "./index";

const read = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/archetype-map/${name}`, import.meta.url), "utf8");

const upload = (text: string, fileName = "InteractiveArchetypeMap.html"): RawInput => ({
  fileName,
  bytes: new TextEncoder().encode(text),
  text,
});

const page = (...hovers: string[]): string =>
  `<html><body><script>Plotly.newPlot("d", [{"mode": "markers", "text": ${JSON.stringify(hovers)}}]);</script></body></html>`;

describe("adapters/archetype-map-html", () => {
  it("reads the real map into its expected decklists", () => {
    const parsed = archetypeMapHtml.parse(upload(read("season-ii-excerpt.html")));
    expect(parsed).toEqual(JSON.parse(read("season-ii-excerpt.expected.json")));
  });

  it("keeps every decklist line verbatim, split cards and foils included", () => {
    const parsed = archetypeMapHtml.parse(upload(read("season-ii-excerpt.html")));
    const lines = parsed.decklists?.[0]?.decklistText.split("\n") ?? [];

    expect(lines).toHaveLength(21);
    expect(lines[0]).toBe("4 Bloomvine Regent / Claim Territory (TDM) 136");
    expect(lines.at(-1)).toBe("2 Swamp (EOE) 264");
  });

  it("reads one player's two dated appearances as two decklists", () => {
    const parsed = archetypeMapHtml.parse(upload(read("season-ii-excerpt.html")));
    const sunsett = parsed.decklists?.filter((d) => d.handle === "Sunsett") ?? [];

    expect(sunsett.map((d) => d.date)).toEqual(["2025-11-15", "2025-11-22"]);
  });

  it("splits the title on the em dash, not on a hyphen in the handle", () => {
    const parsed = archetypeMapHtml.parse(
      upload(page("<b>anti-hero — Mono-Red Aggro (Aggro)</b><br>4 Mountain (EOE) 265")),
    );

    expect(parsed.decklists?.[0]?.handle).toBe("anti-hero");
    expect(parsed.decklists?.[0]?.archetypeRaw).toBe("Mono-Red Aggro (Aggro)");
  });

  it("passes both records through as printed", () => {
    const parsed = archetypeMapHtml.parse(
      upload(page("<b>a — X (Y)</b><br>Rounds: 2-3-0<br>Games: 7-7 (50%)<br>4 Duress (STA) 29")),
    );

    expect(parsed.decklists?.[0]).toMatchObject({ matchRecord: "2-3-0", gameRecord: "7-7" });
  });

  it("keeps a list that carries no date or records", () => {
    const parsed = archetypeMapHtml.parse(upload(page("<b>a — X (Y)</b><br>4 Duress (STA) 29")));

    expect(parsed.decklists?.[0]).toEqual({
      handle: "a",
      decklistText: "4 Duress (STA) 29",
      archetypeRaw: "X (Y)",
    });
  });

  it("decodes the entities an HTML export writes", () => {
    const parsed = archetypeMapHtml.parse(
      upload(page("<b>R&amp;D — X (Y)</b><br>4 Fear of Isolation (DSK) 51")),
    );

    expect(parsed.decklists?.[0]?.handle).toBe("R&D");
  });

  it("skips a node with no decklist behind it, and says whose", () => {
    const parsed = archetypeMapHtml.parse(
      upload(
        page("<b>ghost — X (Y)</b><br><i>2025-11-02</i>", "<b>a — X (Y)</b><br>4 Duress (STA) 29"),
      ),
    );

    expect(parsed.decklists).toHaveLength(1);
    expect(parsed.issues[0]).toMatchObject({
      code: "empty-decklist",
      severity: "warning",
      rowIndex: 0,
    });
    expect(parsed.issues[0]?.message).toContain("ghost");
  });

  it("skips an entry whose title names no player", () => {
    const parsed = archetypeMapHtml.parse(upload(page("Rounds: 2-0-0<br>4 Duress (STA) 29")));

    expect(parsed.capabilities).toEqual([]);
    expect(parsed.decklists).toBeUndefined();
    expect(parsed.issues.map((i) => i.code)).toEqual(["missing-handle", "empty-file"]);
  });

  it("reports a map with no hover text rather than an empty event", () => {
    const parsed = archetypeMapHtml.parse(upload(page()));
    expect(parsed.issues.map((i) => i.code)).toContain("empty-file");
  });

  it("finds the arrays by scanning, so a bracket in a card name cannot truncate one", () => {
    const parsed = archetypeMapHtml.parse(
      upload(page("<b>a — X (Y)</b><br>4 Ancestor's [Chosen] (FDN) 1<br>4 Duress (STA) 29")),
    );

    expect(parsed.decklists?.[0]?.decklistText.split("\n")).toHaveLength(2);
  });

  describe("detect", () => {
    it("claims the map", () => {
      expect(archetypeMapHtml.detect(upload(read("season-ii-excerpt.html")))).toBe(true);
    });

    it("declines a Plotly page that is not the map", () => {
      const other = `<html><script>Plotly.newPlot("d", [{"text": ["Season II win rate"]}]);</script></html>`;
      expect(archetypeMapHtml.detect(upload(other))).toBe(false);
    });

    it("declines anything that is not HTML", () => {
      expect(archetypeMapHtml.detect(upload(read("season-ii-excerpt.html"), "map.txt"))).toBe(
        false,
      );
    });
  });
});
