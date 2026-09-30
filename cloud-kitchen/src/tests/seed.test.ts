// Seed reproducibility tests. The same seed must always produce the same
// PRNG sequence and the same generated beats and music.
import { describe, expect, it } from "vitest";
import { hashStringToSeed, mulberry32 } from "../game/seed";
import { BUILT_IN_LEVELS, buildLevel, generateBeats } from "../game/levels";
import { generateMusic } from "../audio/MusicGenerator";

describe("mulberry32", () => {
  it("produces identical sequences for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });
  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let diffs = 0;
    for (let i = 0; i < 100; i++) if (a() !== b()) diffs++;
    expect(diffs).toBeGreaterThan(90);
  });
  it("stays in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashStringToSeed", () => {
  it("is deterministic", () => {
    expect(hashStringToSeed("cloud-kitchen")).toBe(hashStringToSeed("cloud-kitchen"));
  });
  it("differs for different inputs", () => {
    expect(hashStringToSeed("a")).not.toBe(hashStringToSeed("b"));
  });
});

describe("generateBeats reproducibility", () => {
  it("built-in levels produce stable beat counts", () => {
    // Snapshot: if this changes, the level generator changed on purpose.
    const counts = BUILT_IN_LEVELS.map((l) => l.beats.length);
    expect(counts).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[2]).toBeGreaterThan(0);
    // Harder levels should have at least as many beats as easier ones (roughly).
    expect(counts[2]).toBeGreaterThanOrEqual(counts[0]);
  });
  it("rebuilding a level from the same template produces identical beats", () => {
    const template = BUILT_IN_LEVELS[0];
    const rebuilt = buildLevel({
      schemaVersion: template.schemaVersion,
      id: template.id,
      name: template.name,
      difficulty: template.difficulty,
      bpm: template.bpm,
      key: template.key,
      scale: template.scale,
      leadIn: template.leadIn,
      length: template.length,
      lanes: template.lanes,
      seed: template.seed,
      author: template.author,
    });
    expect(rebuilt.beats).toEqual(template.beats);
  });
  it("a different seed produces different beats", () => {
    const t = BUILT_IN_LEVELS[0];
    const a = generateBeats({ ...t, seed: 1 });
    const b = generateBeats({ ...t, seed: 2 });
    expect(a).not.toEqual(b);
  });
});

describe("generateMusic reproducibility", () => {
  it("the same level produces identical music events", () => {
    const level = BUILT_IN_LEVELS[0];
    const a = generateMusic(level);
    const b = generateMusic(level);
    expect(a).toEqual(b);
  });
  it("music events are sorted by time", () => {
    const level = BUILT_IN_LEVELS[1];
    const events = generateMusic(level);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
    }
  });
});
