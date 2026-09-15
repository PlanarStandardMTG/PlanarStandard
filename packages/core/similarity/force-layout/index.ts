import type { DeckId, SimilarityEdge } from "@ps/contracts";

/**
 * Fruchterman-Reingold, with a seeded PRNG and a fixed schedule.
 *
 * **Reproducibility is the whole point** (E7.4): the same edge list and the same
 * seed must produce byte-identical coordinates on every run and every machine,
 * or the archetype map jumps around between recomputes and nobody can point at a
 * deck and say "over there on the left".
 *
 * Three things make that hold, and all three are load-bearing:
 *   - a seeded PRNG rather than `Math.random`
 *   - node order sorted by deck id, so input order cannot leak in
 *   - only `+ - * /` and `Math.sqrt`, all of which IEEE 754 pins exactly. No
 *     `Math.pow`, `exp` or trigonometry: those are implementation-defined to the
 *     last bit and would differ between engines.
 */

export interface LayoutNode {
  readonly deckId: DeckId;
  readonly x: number;
  readonly y: number;
}

export interface LayoutOptions {
  readonly seed?: number;
  readonly iterations?: number;
  /** Side of the square the layout is normalized into. */
  readonly size?: number;
}

const DEFAULTS = { seed: 0x5eed, iterations: 300, size: 1 } as const;

/** mulberry32 — small, fast, and identical in every JS engine. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(
  edges: readonly SimilarityEdge[],
  deckIds: readonly DeckId[],
  options: LayoutOptions = {},
): readonly LayoutNode[] {
  const seed = options.seed ?? DEFAULTS.seed;
  const iterations = options.iterations ?? DEFAULTS.iterations;
  const size = options.size ?? DEFAULTS.size;

  // Sorted, so the layout depends on the ids and not on how they arrived.
  const ids = [...new Set(deckIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const count = ids.length;
  if (count === 0) return [];
  if (count === 1) return [{ deckId: ids[0] as DeckId, x: 0, y: 0 }];

  const index = new Map(ids.map((id, i) => [id, i]));
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);

  const random = mulberry32(seed);
  for (let i = 0; i < count; i += 1) {
    xs[i] = random() - 0.5;
    ys[i] = random() - 0.5;
  }

  // Only edges whose endpoints are both laid out, in a fixed order.
  const links = edges
    .map((edge) => ({
      a: index.get(edge.deckA),
      b: index.get(edge.deckB),
      weight: edge.similarity,
    }))
    .filter((link): link is { a: number; b: number; weight: number } =>
      link.a !== undefined && link.b !== undefined && link.a !== link.b,
    )
    .sort((p, q) => p.a - q.a || p.b - q.b);

  const area = 1;
  const k = Math.sqrt(area / count);
  const dxs = new Float64Array(count);
  const dys = new Float64Array(count);

  for (let step = 0; step < iterations; step += 1) {
    dxs.fill(0);
    dys.fill(0);

    // Repulsion: every pair pushes apart, k^2 / distance.
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let dx = (xs[i] as number) - (xs[j] as number);
        let dy = (ys[i] as number) - (ys[j] as number);
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1e-9) {
          // Two decks landed on the same point; nudge them apart reproducibly.
          dx = (i - j) * 1e-6;
          dy = 1e-6;
          distance = Math.sqrt(dx * dx + dy * dy);
        }
        const force = (k * k) / distance;
        const ux = (dx / distance) * force;
        const uy = (dy / distance) * force;
        dxs[i] = (dxs[i] as number) + ux;
        dys[i] = (dys[i] as number) + uy;
        dxs[j] = (dxs[j] as number) - ux;
        dys[j] = (dys[j] as number) - uy;
      }
    }

    // Attraction along edges, weighted by similarity: d^2 / k.
    for (const link of links) {
      const dx = (xs[link.a] as number) - (xs[link.b] as number);
      const dy = (ys[link.a] as number) - (ys[link.b] as number);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 1e-9) continue;
      const force = ((distance * distance) / k) * link.weight;
      const ux = (dx / distance) * force;
      const uy = (dy / distance) * force;
      dxs[link.a] = (dxs[link.a] as number) - ux;
      dys[link.a] = (dys[link.a] as number) - uy;
      dxs[link.b] = (dxs[link.b] as number) + ux;
      dys[link.b] = (dys[link.b] as number) + uy;
    }

    // Linear cooling: a fixed schedule, so the run length is part of the output.
    const temperature = 0.1 * (1 - step / iterations);
    for (let i = 0; i < count; i += 1) {
      const dx = dxs[i] as number;
      const dy = dys[i] as number;
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude < 1e-12) continue;
      const limited = Math.min(magnitude, temperature);
      xs[i] = (xs[i] as number) + (dx / magnitude) * limited;
      ys[i] = (ys[i] as number) + (dy / magnitude) * limited;
    }
  }

  return normalize(ids, xs, ys, size);
}

/** Fits the cloud into a centred square, so zoom is stable between recomputes. */
function normalize(
  ids: readonly DeckId[],
  xs: Float64Array,
  ys: Float64Array,
  size: number,
): readonly LayoutNode[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ids.length; i += 1) {
    minX = Math.min(minX, xs[i] as number);
    maxX = Math.max(maxX, xs[i] as number);
    minY = Math.min(minY, ys[i] as number);
    maxY = Math.max(maxY, ys[i] as number);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  const scale = span < 1e-12 ? 0 : size / span;

  return ids.map((deckId, i) => ({
    deckId,
    x: ((xs[i] as number) - (minX + spanX / 2)) * scale,
    y: ((ys[i] as number) - (minY + spanY / 2)) * scale,
  }));
}
