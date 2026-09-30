import { describe, it, expect } from "vitest";
import { GameClock } from "../src/utils/timing";
import { GameEngine } from "../src/game/engine";
import { EASY } from "../src/game/stages";
import { generateEvents } from "../src/game/planets";

// A controllable clock so tests can advance game time deterministically
// without a real AudioContext or requestAnimationFrame.
function makeFakeClock() {
  let t = 0;
  let paused = false;
  const clock = new GameClock(() => t);
  return {
    clock,
    set(v: number) {
      t = v;
    },
    advance(d: number) {
      t += d;
    },
    pause() {
      paused = true;
      clock.pause();
    },
    resume() {
      paused = false;
      clock.resume();
    },
    isPaused() {
      return paused;
    },
  };
}

describe("GameClock pause/resume", () => {
  it("starts at zero and advances with the audio clock", () => {
    const f = makeFakeClock();
    expect(f.clock.now()).toBe(0);
    f.advance(1.5);
    expect(f.clock.now()).toBeCloseTo(1.5);
  });

  it("freezes game time while paused and resumes without losing elapsed", () => {
    const f = makeFakeClock();
    f.advance(2);
    expect(f.clock.now()).toBeCloseTo(2);
    f.pause();
    expect(f.clock.isPaused()).toBe(true);
    // While paused, the underlying audio time keeps moving (real audio does),
    // but game time must stay frozen at the pause point.
    f.advance(5);
    expect(f.clock.now()).toBeCloseTo(2);
    f.resume();
    expect(f.clock.isPaused()).toBe(false);
    // After resume, game time continues from where it froze.
    f.advance(1);
    expect(f.clock.now()).toBeCloseTo(3);
  });

  it("double-pause and double-resume are no-ops", () => {
    const f = makeFakeClock();
    f.advance(1);
    f.pause();
    f.pause();
    expect(f.clock.isPaused()).toBe(true);
    f.advance(3);
    expect(f.clock.now()).toBeCloseTo(1);
    f.resume();
    f.resume();
    expect(f.clock.isPaused()).toBe(false);
    f.advance(2);
    expect(f.clock.now()).toBeCloseTo(3);
  });

  it("pausedFor accumulates total paused duration", () => {
    const f = makeFakeClock();
    f.advance(2);
    f.pause();
    f.advance(4);
    f.resume();
    expect(f.clock.pausedFor()).toBeCloseTo(4);
    f.advance(1);
    f.pause();
    f.advance(2);
    f.resume();
    expect(f.clock.pausedFor()).toBeCloseTo(6);
  });
});

describe("GameEngine state transitions", () => {
  it("starts unfinished and becomes finished after duration + window", () => {
    const f = makeFakeClock();
    const engine = new GameEngine(
      EASY,
      { getGameTime: () => f.clock.now() },
      0,
    );
    expect(engine.isFinished()).toBe(false);
    // Advance to just before the end.
    f.advance(EASY.duration);
    engine.update();
    expect(engine.isFinished()).toBe(false);
    // Advance past the good window so the final events auto-resolve.
    f.advance(EASY.windows.good / 1000 + 0.01);
    engine.update();
    expect(engine.isFinished()).toBe(true);
  });

  it("finish() is idempotent and returns a result", () => {
    const f = makeFakeClock();
    const engine = new GameEngine(
      EASY,
      { getGameTime: () => f.clock.now() },
      0,
    );
    const r1 = engine.finish();
    const r2 = engine.finish();
    expect(r1).toEqual(r2);
    expect(r1.stageId).toBe(EASY.id);
  });

  it("pause via clock freeze prevents auto-miss of upcoming events", () => {
    const f = makeFakeClock();
    const events = generateEvents(EASY);
    const firstEvent = events[0];
    // Move just before the first event, then pause, then jump far ahead in
    // audio time, then resume. The event must NOT have been auto-missed
    // because game time was frozen.
    f.set(Math.max(0, firstEvent.time - 0.05));
    const engine = new GameEngine(
      EASY,
      { getGameTime: () => f.clock.now() },
      0,
    );
    engine.update();
    f.pause();
    f.advance(100); // huge audio-time jump while paused
    engine.update(); // should be a no-op for game time
    const snap = engine.snapshot();
    // No hits recorded yet, and the first event should not be judged.
    expect(snap.hits.length).toBe(0);
    expect(snap.judgedCount).toBe(0);
    f.resume();
    // After resume, pausedFor() holds the 100s that elapsed while paused.
    // To land game time on the event, set audio time to event + pausedFor.
    f.set(firstEvent.time + f.clock.pausedFor());
    const hit = engine.handleInput(firstEvent.planetId, f.clock.now());
    expect(hit?.judgement).toBe("perfect");
  });
});
