// End-to-end happy path. Drives the GameEngine with a fake monotonic clock
// through a full level, simulating perfect inputs, and asserts the final
// score, grade, and state transitions. No real AudioContext is touched.
import { describe, expect, it } from "vitest";
import { GameEngine, type HitEvent } from "../game/engine";
import { BUILT_IN_LEVELS, validateLevel, normalizeLevel, encodeLevel, decodeLevel } from "../game/levels";
import type { Level, Settings } from "../game/types";

const DEFAULT_SETTINGS: Settings = {
  latencyOffset: 0,
  muted: false,
  visualOnly: false,
  reducedMotion: false,
  volume: 0.8,
};

function drivePerfectRun(level: Level): { engine: GameEngine; phases: string[] } {
  const phases: string[] = [];
  let clock = 0;
  // Song starts at audio time 0 + leadIn. We model getAudioTime as the clock
  // and getSongStartAudioTime as the leadIn (the offset).
  const songStart = level.leadIn;
  const getAudioTime = () => clock;
  const getSongStartAudioTime = () => songStart;

  const engine = new GameEngine(level, DEFAULT_SETTINGS, getAudioTime, getSongStartAudioTime, {
    onLevelComplete: () => phases.push("complete"),
    onComboBreak: () => phases.push("combo-break"),
  });

  // Build a map of event id -> event for perfect-hit scheduling.
  const events: HitEvent[] = (engine as unknown as { events: HitEvent[] }).events;
  // Sort by time so we hit them in order.
  const ordered = [...events].sort((a, b) => a.time - b.time);

  // Simulate: advance the clock to each event's hit time and fire the input.
  // For hold-start we press; for hold-end we release; for tap we press.
  // We advance the clock in small steps and call update() to mimic the loop.
  const spb = 60 / level.bpm;
  const step = spb / 4; // quarter-beat steps

  let eventIdx = 0;
  const endTime = level.length + 0.5;

  // Start clock at songStart - small (before song body).
  clock = 0;
  while (clock < songStart + endTime) {
    // Fire any events whose hit time is "now" (within the step).
    while (
      eventIdx < ordered.length &&
      songStart + ordered[eventIdx].time <= clock + step / 2
    ) {
      const ev = ordered[eventIdx];
      const hitTime = songStart + ev.time;
      if (ev.kind === "tap" || ev.kind === "hold-start") {
        engine.onPress(ev.lane, hitTime);
      } else if (ev.kind === "hold-end") {
        engine.onRelease(ev.lane, hitTime);
      }
      eventIdx++;
    }
    engine.update();
    clock += step;
  }
  // Final update to flush completion.
  engine.update();
  return { engine, phases };
}

describe("end-to-end perfect run", () => {
  it("completes the easy level with a full combo and S grade", () => {
    const level = BUILT_IN_LEVELS[0];
    const { engine, phases } = drivePerfectRun(level);
    const result = engine.getFinalResult();
    expect(result).not.toBeNull();
    expect(result!.fullCombo).toBe(true);
    expect(result!.grade).toBe("S");
    expect(result!.accuracy).toBeCloseTo(1.0);
    expect(result!.judgements.miss).toBe(0);
    expect(phases).toContain("complete");
    expect(phases).not.toContain("combo-break");
  });

  it("completes the medium level with a full combo", () => {
    const { engine } = drivePerfectRun(BUILT_IN_LEVELS[1]);
    const result = engine.getFinalResult();
    expect(result!.fullCombo).toBe(true);
    expect(result!.grade).toBe("S");
  });

  it("completes the hard level (with holds and two-steps) with a full combo", () => {
    const { engine } = drivePerfectRun(BUILT_IN_LEVELS[2]);
    const result = engine.getFinalResult();
    expect(result!.fullCombo).toBe(true);
    expect(result!.grade).toBe("S");
    // Hard level should have at least some hold and two-step beats.
    const beats = BUILT_IN_LEVELS[2].beats;
    const hasHold = beats.some((b) => b.type === "hold");
    const hasTwoStep = beats.some((b) => b.type === "two-step");
    expect(hasHold || hasTwoStep).toBe(true);
  });
});

describe("engine state transitions", () => {
  it("marks the run finished only after all events are judged", () => {
    const level = BUILT_IN_LEVELS[0];
    let clock = 0;
    const songStart = level.leadIn;
    const engine = new GameEngine(
      level,
      DEFAULT_SETTINGS,
      () => clock,
      () => songStart
    );
    // Before any input: not finished.
    engine.update();
    expect(engine.snapshot().finished).toBe(false);
    // Advance past the end without hitting anything -> all misses, finished.
    clock = songStart + level.length + 0.5;
    engine.update();
    expect(engine.snapshot().finished).toBe(true);
    const result = engine.getFinalResult();
    expect(result!.judgements.miss).toBeGreaterThan(0);
    expect(result!.grade).toBe("D");
  });

  it("abort flushes pending events as misses and returns a result", () => {
    const level = BUILT_IN_LEVELS[0];
    const engine = new GameEngine(
      level,
      DEFAULT_SETTINGS,
      () => 0,
      () => level.leadIn
    );
    const result = engine.abort();
    expect(result).toBeDefined();
    expect(result.judgements.miss).toBeGreaterThan(0);
    expect(engine.snapshot().finished).toBe(true);
  });
});

describe("level validation and round-trip", () => {
  it("all built-in levels validate", () => {
    for (const level of BUILT_IN_LEVELS) {
      const r = validateLevel(level);
      expect(r.ok, r.errors.join("; ")).toBe(true);
      expect(r.errors).toEqual([]);
    }
  });
  it("encode then decode round-trips a level", () => {
    const level = normalizeLevel(BUILT_IN_LEVELS[0]);
    const code = encodeLevel(level);
    const decoded = decodeLevel(code) as Level;
    expect(decoded).toEqual(level);
    expect(validateLevel(decoded).ok).toBe(true);
  });
  it("rejects an invalid level with clear errors", () => {
    const r = validateLevel({ schemaVersion: 999, id: "", name: "", bpm: 10, lanes: 9, beats: "nope" });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
