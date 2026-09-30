// Scoring tests. Pure functions, deterministic.
import { describe, expect, it } from "vitest";
import {
  aggregateScore,
  comboMultiplier,
  gradeFor,
  judgeHoldRelease,
  judgeTap,
  JUDGEMENT_WEIGHT,
} from "../game/scoring";
import type { Beat, Judgement } from "../game/types";
import { BUILT_IN_LEVELS } from "../game/levels";

const SONG_START = 100; // arbitrary audio-clock anchor

function beat(time: number, type: Beat["type"] = "tap", duration?: number): Beat {
  return { id: `b${time}`, time, lane: 0, type, ingredient: 0, duration };
}

describe("judgeTap", () => {
  it("returns perfect within 50ms", () => {
    const b = beat(5);
    expect(judgeTap(SONG_START + 5.0, b, SONG_START, 0)).toBe("perfect");
    expect(judgeTap(SONG_START + 5.04, b, SONG_START, 0)).toBe("perfect");
    expect(judgeTap(SONG_START + 4.96, b, SONG_START, 0)).toBe("perfect");
  });
  it("returns great within 100ms", () => {
    const b = beat(5);
    expect(judgeTap(SONG_START + 5.09, b, SONG_START, 0)).toBe("great");
    expect(judgeTap(SONG_START + 4.91, b, SONG_START, 0)).toBe("great");
  });
  it("returns good within 150ms", () => {
    const b = beat(5);
    expect(judgeTap(SONG_START + 5.14, b, SONG_START, 0)).toBe("good");
  });
  it("returns miss outside 150ms", () => {
    const b = beat(5);
    expect(judgeTap(SONG_START + 5.2, b, SONG_START, 0)).toBe("miss");
    expect(judgeTap(SONG_START + 4.8, b, SONG_START, 0)).toBe("miss");
  });
  it("applies latency offset", () => {
    const b = beat(5);
    // Input 80ms late, but latencyOffset 30ms means corrected to 50ms -> perfect.
    expect(judgeTap(SONG_START + 5.08, b, SONG_START, 0.03)).toBe("perfect");
    // Input 80ms late, latencyOffset -30ms -> corrected delta 110ms -> good.
    expect(judgeTap(SONG_START + 5.08, b, SONG_START, -0.03)).toBe("good");
  });
});

describe("judgeHoldRelease", () => {
  it("judges against beat.time + duration", () => {
    const b = beat(5, "hold", 1.0);
    expect(judgeHoldRelease(SONG_START + 6.0, b, SONG_START, 0)).toBe("perfect");
    expect(judgeHoldRelease(SONG_START + 6.12, b, SONG_START, 0)).toBe("good");
    expect(judgeHoldRelease(SONG_START + 7.0, b, SONG_START, 0)).toBe("miss");
  });
});

describe("comboMultiplier", () => {
  it("starts at 1.0 and caps at 1.5", () => {
    expect(comboMultiplier(0)).toBe(1.0);
    expect(comboMultiplier(10)).toBe(1.02);
    expect(comboMultiplier(100)).toBe(1.2);
    expect(comboMultiplier(250)).toBe(1.5);
    expect(comboMultiplier(9999)).toBe(1.5);
  });
});

describe("aggregateScore", () => {
  it("scores a perfect full clear as S with max combo", () => {
    const beats = BUILT_IN_LEVELS[0].beats;
    const events: Judgement[] = beats.map(() => "perfect");
    const result = aggregateScore(events, beats.length);
    expect(result.fullCombo).toBe(true);
    expect(result.grade).toBe("S");
    expect(result.judgements.perfect).toBe(events.length);
    expect(result.judgements.miss).toBe(0);
    expect(result.maxCombo).toBe(events.length);
    expect(result.accuracy).toBeCloseTo(1.0);
  });
  it("scores all misses as D", () => {
    const beats = BUILT_IN_LEVELS[0].beats;
    const events: Judgement[] = beats.map(() => "miss");
    const result = aggregateScore(events, beats.length);
    expect(result.grade).toBe("D");
    expect(result.score).toBe(0);
    expect(result.fullCombo).toBe(false);
    expect(result.maxCombo).toBe(0);
  });
  it("resets combo on miss and tracks max combo", () => {
    const events: Judgement[] = ["perfect", "great", "miss", "perfect", "perfect"];
    const result = aggregateScore(events, 5);
    // Combo: 1, 2, 0 (miss resets), 1, 2 -> max 2.
    expect(result.maxCombo).toBe(2);
    expect(result.judgements.miss).toBe(1);
  });
  it("accuracy is hit / total", () => {
    const events: Judgement[] = ["perfect", "great", "good", "miss"];
    const result = aggregateScore(events, 4);
    expect(result.accuracy).toBeCloseTo(0.75);
  });
});

describe("gradeFor", () => {
  it("S requires no misses and >= 0.95 accuracy", () => {
    expect(gradeFor(1.0, true)).toBe("S");
    expect(gradeFor(0.96, true)).toBe("S");
    expect(gradeFor(1.0, false)).not.toBe("S");
    expect(gradeFor(0.96, false)).toBe("A");
  });
  it("grades A/B/C/D by accuracy thresholds", () => {
    expect(gradeFor(0.9, false)).toBe("A");
    expect(gradeFor(0.8, false)).toBe("B");
    expect(gradeFor(0.6, false)).toBe("C");
    expect(gradeFor(0.3, false)).toBe("D");
  });
});

describe("JUDGEMENT_WEIGHT", () => {
  it("orders perfect > great > good > miss", () => {
    expect(JUDGEMENT_WEIGHT.perfect).toBeGreaterThan(JUDGEMENT_WEIGHT.great);
    expect(JUDGEMENT_WEIGHT.great).toBeGreaterThan(JUDGEMENT_WEIGHT.good);
    expect(JUDGEMENT_WEIGHT.good).toBeGreaterThan(JUDGEMENT_WEIGHT.miss);
  });
});
