/** FNV-1a, 32-bit: turns the run's seed (and a salt) into mulberry32's state. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A generator in [0, 1) that is identical in every JS engine for the same seed, so a
 * re-pair or a re-read reproduces every random choice (§28). Salt the seed per use —
 * `${seed}:round:3` — so two uses never share a stream.
 */
export function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    // mulberry32, as in core/similarity/force-layout.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Fisher–Yates shuffle driven by `seededRandom(seed)`. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
  }
  return shuffled;
}
