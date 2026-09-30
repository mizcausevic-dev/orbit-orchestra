import { describe, it, expect } from "vitest";
import { mulberry32, createRng, hashStringToSeed } from "../src/game/rng";

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let diff = 0;
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) diff++;
    }
    expect(diff).toBeGreaterThan(90);
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createRng", () => {
  it("range stays within bounds", () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it("int is inclusive of both ends over many samples", () => {
    const r = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      seen.add(r.int(1, 4));
    }
    expect(seen.size).toBe(4);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(4)).toBe(true);
  });

  it("pick returns an element from the array", () => {
    const r = createRng(3);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it("pick throws on an empty array", () => {
    const r = createRng(3);
    expect(() => r.pick([])).toThrow();
  });
});

describe("hashStringToSeed", () => {
  it("is deterministic for the same input", () => {
    expect(hashStringToSeed("orbit-orchestra")).toBe(hashStringToSeed("orbit-orchestra"));
  });

  it("differs for different inputs", () => {
    expect(hashStringToSeed("a")).not.toBe(hashStringToSeed("b"));
  });

  it("returns a 32-bit unsigned value", () => {
    const s = hashStringToSeed("hello");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(s)).toBe(true);
  });
});
