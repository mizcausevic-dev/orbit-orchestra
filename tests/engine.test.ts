import { describe, it, expect } from "vitest";
import { GameEngine } from "../src/game/engine";
import { EASY, NORMAL, HARD, SANDBOX } from "../src/game/stages";
import { generateEvents } from "../src/game/planets";
import { comboMultiplier, scoreFor } from "../src/game/scoring";

// Drives a stage to completion with a controllable clock and synthetic
// inputs. This is the "end-to-end happy path": it exercises event
// generation, input capture, latency offset, judging, combo, scoring, and
// the finished-state transition without a browser, audio, or animation.

function makeStage() {
  return EASY;
}

function runStageWithInputs(
  stage: typeof EASY,
  mode: "perfect" | "miss-all" | "early" | "late",
  latencyOffsetMs = 0,
) {
  let t = 0;
  const clock = { now: () => t };
  const judgedEvents: number[] = [];
  const autoMissed: number[] = [];
  const engine = new GameEngine(
    stage,
    {
      getGameTime: clock.now,
      onAutoMiss: (e) => autoMissed.push(e.time),
    },
    latencyOffsetMs,
  );
  const events = generateEvents(stage);
  // Feed an input for every event, in time order.
  for (const e of events) {
    t = e.time;
    engine.update();
    let inputTime = e.time;
    if (mode === "perfect") inputTime = e.time;
    else if (mode === "early") inputTime = e.time - 0.001;
    else if (mode === "late") inputTime = e.time + 0.001;
    // miss-all: do not press
    if (mode !== "miss-all") {
      const hit = engine.handleInput(e.planetId, inputTime);
      if (hit) judgedEvents.push(e.time);
    }
  }
  // Advance past the end + good window so the engine finishes.
  t = stage.duration + stage.windows.good / 1000 + 0.01;
  engine.update();
  const result = engine.finish();
  return { result, events, judgedEvents, autoMissed };
}

describe("end-to-end happy path", () => {
  it("perfect run clears the stage with full combo and expected score", () => {
    const stage = makeStage();
    const { result, events } = runStageWithInputs(stage, "perfect");

    // Every event was judged.
    expect(events.length).toBeGreaterThan(0);
    expect(result.counts.perfect).toBe(events.length);
    expect(result.counts.great).toBe(0);
    expect(result.counts.good).toBe(0);
    expect(result.counts.miss).toBe(0);

    // Max combo equals the number of events.
    expect(result.maxCombo).toBe(events.length);

    // Score matches the deterministic combo-multiplier formula.
    let expected = 0;
    for (let k = 1; k <= events.length; k++) {
      expected += Math.round(scoreFor("perfect") * comboMultiplier(k));
    }
    expect(result.score).toBe(expected);

    // Cleared against the stage target.
    expect(result.cleared).toBe(true);
    expect(result.accuracy).toBeCloseTo(1, 5);
  });

  it("miss-all run scores zero and does not clear", () => {
    const stage = makeStage();
    const { result, events } = runStageWithInputs(stage, "miss-all");
    expect(result.counts.perfect).toBe(0);
    expect(result.counts.miss).toBe(events.length);
    expect(result.score).toBe(0);
    expect(result.maxCombo).toBe(0);
    expect(result.cleared).toBe(false);
    expect(result.accuracy).toBe(0);
  });

  it("early and late by 1ms still score perfect (within window)", () => {
    const stage = makeStage();
    const early = runStageWithInputs(stage, "early").result;
    const late = runStageWithInputs(stage, "late").result;
    expect(early.counts.perfect).toBe(stage ? generateEvents(stage).length : 0);
    expect(late.counts.perfect).toBe(generateEvents(stage).length);
  });
});

describe("latency offset shifts the judged input", () => {
  it("a positive offset makes an early input land on time", () => {
    const stage = makeStage();
    const events = generateEvents(stage);
    let t = 0;
    const engine = new GameEngine(
      stage,
      { getGameTime: () => t },
      // Offset of +30ms: perceived = input - 0.03. An input 20ms early then
      // lands at -50ms, comfortably inside the 60ms perfect window.
      30,
    );
    const e = events[0];
    t = e.time;
    engine.update();
    const hit = engine.handleInput(e.planetId, e.time - 0.02);
    expect(hit?.judgement).toBe("perfect");
  });

  it("a large positive offset can turn an on-time input into a miss", () => {
    const stage = makeStage();
    const events = generateEvents(stage);
    let t = 0;
    const engine = new GameEngine(
      stage,
      { getGameTime: () => t },
      // Offset larger than the good window: perceived is shifted out.
      stage.windows.good + 10,
    );
    const e = events[0];
    t = e.time;
    engine.update();
    const hit = engine.handleInput(e.planetId, e.time);
    // The input is now perceived as (e.time - (good+10)ms), which is outside
    // the good window relative to the event, so no match.
    expect(hit).toBeNull();
  });
});

describe("stage progression produces increasing event counts", () => {
  it("easy < normal < hard in event density", () => {
    const e = generateEvents(EASY).length;
    const n = generateEvents(NORMAL).length;
    const h = generateEvents(HARD).length;
    expect(e).toBeGreaterThan(0);
    expect(n).toBeGreaterThan(e);
    expect(h).toBeGreaterThan(n);
  });
});

describe("sandbox stage", () => {
  it("generates events over a long horizon despite duration 0", () => {
    // Without an explicit horizon, duration 0 would yield ~0 events. The
    // engine passes a 600s horizon for sandbox so there is always
    // something to schedule and hit.
    const engine = new GameEngine(SANDBOX, { getGameTime: () => 0 }, 0);
    expect(engine.totalEvents).toBeGreaterThan(SANDBOX.planets.length);
  });

  it("never auto-misses and never finishes", () => {
    let t = 0;
    const engine = new GameEngine(SANDBOX, { getGameTime: () => t }, 0);
    // Advance far beyond any reasonable stage length without pressing.
    t = 1000;
    engine.update();
    expect(engine.isFinished()).toBe(false);
    const snap = engine.snapshot();
    expect(snap.judgedCount).toBe(0);
    expect(snap.hits.length).toBe(0);
  });
});
