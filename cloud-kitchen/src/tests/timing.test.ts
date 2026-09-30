// Timing tests. Pure functions.
import { describe, expect, it } from "vitest";
import {
  absError,
  audioTimeToSongPosition,
  beatToAudioTime,
  nearestBeatIndex,
  secondsPerBeat,
  timingDelta,
} from "../game/timing";

const SONG_START = 1000;

describe("beatToAudioTime / audioTimeToSongPosition", () => {
  it("converts beat time to absolute audio time and back", () => {
    expect(beatToAudioTime(5, SONG_START)).toBe(1005);
    expect(audioTimeToSongPosition(1005, SONG_START)).toBe(5);
  });
});

describe("timingDelta", () => {
  it("is zero on perfect input", () => {
    expect(timingDelta(SONG_START + 5, 5, SONG_START, 0)).toBe(0);
  });
  it("is positive when late, negative when early", () => {
    expect(timingDelta(SONG_START + 5.1, 5, SONG_START, 0)).toBeCloseTo(0.1);
    expect(timingDelta(SONG_START + 4.9, 5, SONG_START, 0)).toBeCloseTo(-0.1);
  });
  it("applies latency offset by subtracting it from input", () => {
    // Input 80ms late, offset 30ms -> corrected delta 50ms.
    expect(timingDelta(SONG_START + 5.08, 5, SONG_START, 0.03)).toBeCloseTo(0.05);
  });
});

describe("absError", () => {
  it("returns absolute value of timingDelta", () => {
    expect(absError(SONG_START + 5.12, 5, SONG_START, 0)).toBeCloseTo(0.12);
    expect(absError(SONG_START + 4.88, 5, SONG_START, 0)).toBeCloseTo(0.12);
  });
});

describe("secondsPerBeat", () => {
  it("returns 0.5s at 120bpm", () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5);
  });
  it("throws on non-positive bpm", () => {
    expect(() => secondsPerBeat(0)).toThrow();
    expect(() => secondsPerBeat(-10)).toThrow();
  });
});

describe("nearestBeatIndex", () => {
  it("rounds to the nearest beat", () => {
    expect(nearestBeatIndex(0, 120)).toBe(0);
    expect(nearestBeatIndex(0.5, 120)).toBe(1);
    expect(nearestBeatIndex(0.24, 120)).toBe(0);
    expect(nearestBeatIndex(0.26, 120)).toBe(1);
  });
});
