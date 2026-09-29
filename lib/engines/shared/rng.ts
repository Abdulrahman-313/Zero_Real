/**
 * Deterministic pseudo-random utilities. Every engine derives per-record seeds
 * from (seed, scope, index) so any record can be regenerated independently and
 * previews are always an exact prefix of full exports.
 */

const UINT32 = 0x1_0000_0000;

/** FNV-1a 32-bit hash of a string. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Murmur3 finalizer: scrambles a 32-bit integer. */
function mix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Combines any number of seed parts into one well-distributed 32-bit seed. */
export function deriveSeed(...parts: ReadonlyArray<number | string>): number {
  let h = 0x9e3779b9;
  for (const part of parts) {
    const n = typeof part === "number" ? Math.trunc(part) >>> 0 : hashString(part);
    h = mix32(h ^ mix32(n + 0x6d2b79f5));
  }
  return h;
}

/** Mulberry32: tiny, fast, good-quality 32-bit generator. Returns [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Standard normal sample (Box–Muller). */
  normal(): number;
  /** Laplace(0, scale) sample. */
  laplace(scale: number): number;
  shuffle<T>(items: readonly T[]): T[];
  /** k distinct items (k is clamped to items.length). */
  sample<T>(items: readonly T[], k: number): T[];
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  const rng: Rng = {
    next,
    int(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return p > 0 && next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      return items[Math.floor(next() * items.length)];
    },
    weighted(items, weights) {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      let total = 0;
      for (let i = 0; i < items.length; i++) total += Math.max(0, weights[i] ?? 1);
      if (total <= 0) return rng.pick(items);
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= Math.max(0, weights[i] ?? 1);
        if (roll < 0) return items[i];
      }
      return items[items.length - 1];
    },
    normal() {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    laplace(scale) {
      const u = next() - 0.5;
      return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample(items, k) {
      return rng.shuffle(items).slice(0, Math.max(0, Math.min(k, items.length)));
    },
  };
  return rng;
}

/** Adapter satisfying faker's `Randomizer` interface, backed by mulberry32. */
export function createFakerRandomizer(initialSeed = 0): {
  next: () => number;
  seed: (seed: number | number[]) => void;
} {
  let gen = mulberry32(initialSeed);
  return {
    next: () => gen(),
    seed: (seed) => {
      gen = mulberry32(Array.isArray(seed) ? deriveSeed(...seed) : seed);
    },
  };
}
