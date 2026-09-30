import { describe, it, expect } from "vitest";
import { generateEvents, BEAT_LINE_ANGLE, planetAngle } from "../src/game/planets";
import { EASY, NORMAL, HARD, SANDBOX } from "../src/game/stages";
import type { StageConfig } from "../src/game/types";

describe("generateEvents determinism", () => {
  it("produces identical output for the same stage config", () => {
    const a = generateEvents(EASY);
    const b = generateEvents(EASY);
    expect(a).toEqual(b);
  });

  it("produces identical output across separate calls for all stages", () => {
    for (const s of [EASY, NORMAL, HARD, SANDBOX]) {
      expect(generateEvents(s)).toEqual(generateEvents(s));
    }
  });
});

describe("generateEvents correctness", () => {
  it("places every event exactly on a beat-line crossing", () => {
    for (const s of [EASY, NORMAL, HARD]) {
      const events = generateEvents(s);
      for (const e of events) {
        const planet = s.planets.find((p) => p.id === e.planetId)!;
        const angle = planetAngle(planet, e.time);
        // Minimal signed distance to the beat line modulo 2π, wrapped to
        // [-π, π]. A crossing means this distance is ~0 (not ~2π).
        let diff = (angle - BEAT_LINE_ANGLE) % (2 * Math.PI);
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        expect(Math.abs(diff)).toBeLessThan(1e-6);
      }
    }
  });

  it("events are sorted by time", () => {
    for (const s of [EASY, NORMAL, HARD, SANDBOX]) {
      const events = generateEvents(s);
      for (let i = 1; i < events.length; i++) {
        expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
      }
    }
  });

  it("respects the stage duration bound", () => {
    for (const s of [EASY, NORMAL, HARD]) {
      const events = generateEvents(s);
      for (const e of events) {
        expect(e.time).toBeLessThanOrEqual(s.duration + 1e-6);
      }
    }
  });

  it("event count matches the expected number of crossings", () => {
    // For a planet with period P over duration D, crossings = floor(D / P)
    // (when startAngle aligns so the first crossing is at t = 0..P).
    const stage: StageConfig = {
      id: "test",
      name: "test",
      difficulty: "easy",
      seed: 1,
      duration: 10,
      bpm: 60,
      targetScore: 0,
      windows: { perfect: 40, great: 80, good: 120 },
      planets: [
        { id: 1, radius: 100, period: 2, startAngle: BEAT_LINE_ANGLE, color: "#fff", key: "a", instrument: "bell", label: "I" },
        { id: 2, radius: 160, period: 5, startAngle: BEAT_LINE_ANGLE, color: "#fff", key: "s", instrument: "pluck", label: "II" },
      ],
    };
    const events = generateEvents(stage);
    const p1 = events.filter((e) => e.planetId === 1).length;
    const p2 = events.filter((e) => e.planetId === 2).length;
    // period 2 over 10s -> crossings at t=0,2,4,6,8,10 => 6
    expect(p1).toBe(6);
    // period 5 over 10s -> t=0,5,10 => 3
    expect(p2).toBe(3);
  });
});
