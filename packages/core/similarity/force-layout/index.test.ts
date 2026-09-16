import { readFileSync } from "node:fs";

import type { DeckId, SeasonId, SimilarityEdge } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { forceLayout } from "./index";

const SEASON = "season-ii" as SeasonId;
const id = (n: number): DeckId => `deck-${String(n).padStart(3, "0")}` as DeckId;

const edge = (a: number, b: number, similarity = 0.7): SimilarityEdge => ({
  seasonId: SEASON,
  deckA: id(a),
  deckB: id(b),
  similarity,
  sharedCards: 30,
});

/** Two tight clusters joined by a single bridge — the shape a real metagame has. */
const CLUSTERED = {
  ids: Array.from({ length: 10 }, (_, i) => id(i)),
  edges: [
    edge(0, 1),
    edge(0, 2),
    edge(1, 2),
    edge(2, 3),
    edge(0, 3),
    edge(1, 3),
    edge(5, 6),
    edge(5, 7),
    edge(6, 7),
    edge(7, 8),
    edge(5, 8),
    edge(6, 8),
    edge(3, 5, 0.52),
  ],
};

describe("core/similarity/force-layout", () => {
  it("produces byte-identical output for the same input and seed", () => {
    // The acceptance criterion. Serialized, so this compares every last bit.
    const once = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42 });
    const again = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42 });
    expect(JSON.stringify(again)).toBe(JSON.stringify(once));
  });

  it("is unaffected by the order the nodes and edges arrive in", () => {
    const straight = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42 });
    const shuffled = forceLayout([...CLUSTERED.edges].reverse(), [...CLUSTERED.ids].reverse(), {
      seed: 42,
    });
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(straight));
  });

  it("produces a different layout for a different seed", () => {
    const a = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 1 });
    const b = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 2 });
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });

  it("uses only arithmetic that IEEE 754 pins exactly", () => {
    // Guards the reproducibility promise: Math.pow, exp and the trig functions
    // are implementation-defined to the last bit and would differ between engines.
    const source = readSource();
    for (const forbidden of [
      "Math.pow",
      "Math.exp",
      "Math.log",
      "Math.sin",
      "Math.cos",
      "Math.atan",
      "**",
      "Math.random",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    // Only sqrt, which IEEE 754 requires to be correctly rounded.
    expect(source).toContain("Math.sqrt");
  });

  it("places one node at the origin and no nodes at all for none", () => {
    expect(forceLayout([], [], {})).toEqual([]);
    expect(forceLayout([], [id(0)], {})).toEqual([{ deckId: id(0), x: 0, y: 0 }]);
  });

  it("returns one point per distinct deck, in sorted order", () => {
    const nodes = forceLayout(CLUSTERED.edges, [...CLUSTERED.ids, id(0)], { seed: 42 });
    expect(nodes).toHaveLength(10);
    expect(nodes.map((n) => n.deckId)).toEqual([...CLUSTERED.ids].sort());
  });

  it("emits finite coordinates inside the normalized square", () => {
    for (const node of forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42, size: 1 })) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Math.abs(node.x)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(node.y)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it("pulls connected decks closer than unconnected ones", () => {
    const nodes = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42 });
    const at = (n: number) =>
      nodes.find((node) => node.deckId === id(n)) as { x: number; y: number };
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // 0 and 1 share an edge; 0 and 9 are in different components entirely.
    expect(distance(at(0), at(1))).toBeLessThan(distance(at(0), at(9)));
  });

  it("separates the two clusters", () => {
    const nodes = forceLayout(CLUSTERED.edges, CLUSTERED.ids, { seed: 42 });
    const at = (n: number) =>
      nodes.find((node) => node.deckId === id(n)) as { x: number; y: number };
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const withinCluster = distance(at(0), at(1));
    const acrossClusters = distance(at(0), at(6));
    expect(acrossClusters).toBeGreaterThan(withinCluster);
  });

  it("ignores an edge naming a deck that is not in the node list", () => {
    const nodes = forceLayout([edge(0, 99)], [id(0), id(1)], { seed: 42 });
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => Number.isFinite(n.x))).toBe(true);
  });
});

/** The module's code with comments removed — the prose names the very things it avoids. */
function readSource(): string {
  return readFileSync(new URL("./index.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}
