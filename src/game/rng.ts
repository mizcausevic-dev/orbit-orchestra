// Deterministic, seedable pseudo-random number generator.
//
// mulberry32 is a small, fast, well-distributed PRNG. It is NOT
// cryptographically secure and is not used for anything security-sensitive.
// It exists so that stage decoration and any randomized test fixtures are
// fully reproducible from a single integer seed.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick a random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error("Rng.pick called on an empty array");
      }
      return arr[Math.floor(next() * arr.length)];
    },
  };
}

/** Hash an arbitrary string into a 32-bit unsigned integer. Used to derive
 * a numeric seed from a stage id or other string label. */
export function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
