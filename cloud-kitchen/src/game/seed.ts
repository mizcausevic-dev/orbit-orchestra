// Deterministic PRNG. Used for music generation and for any test that needs
// reproducible randomness. The same seed always produces the same sequence.

/**
 * mulberry32 — a small, fast, deterministic PRNG. Not cryptographically secure.
 * Returns a function that yields a float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  // Coerce to uint32 to keep behavior identical across runtimes.
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a uint32 seed. Used to derive a seed from a level id. */
export function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
