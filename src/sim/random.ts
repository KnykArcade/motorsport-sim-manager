// Deterministic seeded random number generator.
// Same seed + same call sequence => same results, so a save file replays
// identically. All simulation randomness MUST go through this, never Math.random.

export type Rng = {
  next: () => number; // [0, 1)
  int: (minInclusive: number, maxInclusive: number) => number;
  range: (min: number, max: number) => number;
  // Gaussian-ish variance centered on 0, roughly within [-1, 1].
  variance: (scale?: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(items: T[]) => T;
};

// xmur3 string hash -> 32-bit seed.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 PRNG.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: string): Rng {
  const seedFn = xmur3(seed);
  const rand = mulberry32(seedFn());

  const next = () => rand();

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    variance: (scale = 1) => {
      // Average of two uniforms approximates a triangular distribution.
      const v = (next() + next() - 1); // [-1, 1], peaked at 0
      return v * scale;
    },
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

// Build a stable per-context seed so each race/quali is deterministic but unique.
export function deriveSeed(...parts: (string | number)[]): string {
  return parts.join('|');
}
