// Game engine: pure state machine and timing logic.
//
// The engine is deliberately decoupled from the audio context and the DOM.
// It receives the current game time through an injected `getGameTime`
// callback (the React layer wires this to AudioContext.currentTime, minus
// any pause offset). Input times are passed explicitly to `handleInput` so
// the moment of capture is controlled by the caller, not re-sampled here.
//
// This separation is what makes the deterministic tests possible: a test
// drives a fake clock forward, feeds synthetic inputs, and asserts on the
// resulting score and combo state without a browser or audio hardware.

import type {
  HitResult,
  Judgement,
  ScheduledEvent,
  StageConfig,
  StageResult,
} from "./types";
import { generateEvents } from "./planets";
import { judge, nearestEvent, scoreFor, comboMultiplier, tallyResults } from "./scoring";

export interface EngineCallbacks {
  /** Returns the current game time in seconds (audio clock, pause-adjusted). */
  getGameTime: () => number;
  /** Fired when a player input is resolved into a judgement. */
  onJudgement?: (hit: HitResult) => void;
  /** Fired when an event auto-expires as a miss because the window passed. */
  onAutoMiss?: (event: ScheduledEvent) => void;
  /** Fired when an event becomes "active" (enters the good window) so the
   * audio layer can schedule the planet's own tick sound for sandbox /
   * autoplay / visual-only modes. */
  onEventActive?: (event: ScheduledEvent) => void;
}

export interface EngineState {
  score: number;
  combo: number;
  maxCombo: number;
  hits: HitResult[];
  judgedCount: number;
  totalEvents: number;
  finished: boolean;
}

export class GameEngine {
  private readonly stage: StageConfig;
  private readonly events: ScheduledEvent[];
  private readonly judged = new Set<number>();
  private readonly hits: HitResult[] = [];
  private readonly activeFired = new Set<number>();
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private finished = false;
  private readonly latencyOffsetSec: number;
  private readonly cb: EngineCallbacks;
  /** Sandbox stages have no duration and never auto-miss or finish. */
  private readonly noMiss: boolean;

  constructor(stage: StageConfig, cb: EngineCallbacks, latencyOffsetMs = 0) {
    this.stage = stage;
    this.cb = cb;
    this.latencyOffsetSec = latencyOffsetMs / 1000;
    // Sandbox (duration 0) is unlimited: generate a 10-minute horizon so
    // there are always upcoming events to schedule and hit, and never
    // auto-miss or finish.
    const horizon = stage.duration > 0 ? undefined : 600;
    this.noMiss = stage.duration <= 0;
    this.events = generateEvents(stage, horizon);
  }

  get totalEvents(): number {
    return this.events.length;
  }

  getEvent(index: number): ScheduledEvent | undefined {
    return this.events[index];
  }

  getEvents(): readonly ScheduledEvent[] {
    return this.events;
  }

  snapshot(): EngineState {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      hits: [...this.hits],
      judgedCount: this.judged.size,
      totalEvents: this.events.length,
      finished: this.finished,
    };
  }

  /** Resolve a player input for a planet. Returns the hit result, or null
   * if no event was within the good window (an "empty press" that does not
   * break combo by default). The input time is the raw audio-clock time at
   * the moment of the keypress; the latency offset is applied here. */
  handleInput(planetId: number, rawInputTimeSec: number): HitResult | null {
    if (this.finished) return null;
    const perceived = rawInputTimeSec - this.latencyOffsetSec;
    const match = nearestEvent(
      this.events,
      planetId,
      perceived,
      this.stage.windows,
      this.judged,
    );
    if (!match) return null;

    const j: Judgement = judge(match.deltaMs, this.stage.windows);
    this.judged.add(match.index);
    const hit: HitResult = {
      judgement: j,
      deltaMs: match.deltaMs,
      planetId,
      inputTime: perceived,
    };
    this.hits.push(hit);

    if (j !== "miss") {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round(scoreFor(j) * comboMultiplier(this.combo));
    } else {
      this.combo = 0;
    }
    this.cb.onJudgement?.(hit);
    return hit;
  }

  /** Per-frame update. Auto-misses events whose good window has elapsed and
   * fires onEventActive for events entering the window. Sandbox stages skip
   * auto-miss entirely. */
  update(): void {
    if (this.finished) return;
    const now = this.cb.getGameTime();
    const goodSec = this.stage.windows.good / 1000;
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      if (this.judged.has(i)) continue;
      const delta = now - e.time;
      // Fire "active" once the event is within the good window ahead of time
      // so the audio layer can schedule the planet tick slightly early.
      if (!this.activeFired.has(i) && delta >= -goodSec) {
        this.activeFired.add(i);
        this.cb.onEventActive?.(e);
      }
      // Auto-miss once the window has fully elapsed (skipped in sandbox).
      if (!this.noMiss && delta > goodSec) {
        this.judged.add(i);
        this.combo = 0;
        this.hits.push({
          judgement: "miss",
          deltaMs: delta * 1000,
          planetId: e.planetId,
          inputTime: now,
        });
        this.cb.onAutoMiss?.(e);
      }
    }
    // Finish when the stage duration has elapsed (sandbox never finishes
    // because duration is 0).
    if (this.stage.duration > 0 && now >= this.stage.duration + goodSec) {
      this.finished = true;
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  /** Force-finish the stage (e.g. when the player quits). Unjudged events
   * become misses. */
  finish(): StageResult {
    if (!this.finished) {
      this.finished = true;
    }
    const tally = tallyResults(this.hits, this.events.length, this.stage.targetScore);
    return { ...tally, stageId: this.stage.id };
  }
}
