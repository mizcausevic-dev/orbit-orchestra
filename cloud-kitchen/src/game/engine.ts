// GameEngine — core state machine for a single play of a level.
// Framework-agnostic and testable. Judgment uses injected getAudioTime() and
// getSongStartAudioTime() so tests can drive it with a fake clock.
//
// Each beat expands into one or more hit events:
//   tap      -> 1 event (tap)
//   hold     -> 2 events (hold-start on press, hold-end on release)
//   two-step -> 2 events (tap at beat.time, tap at beat.time + stepGap)

import {
  GOOD_WINDOW,
  MISS_WINDOW,
  absError,
} from "./timing";
import {
  aggregateScore,
  earlyLate,
  judgeHoldRelease,
  judgeTap,
} from "./scoring";
import type { Beat, Judgement, Level, ScoreResult, Settings } from "./types";

export type HitEventKind = "tap" | "hold-start" | "hold-end";

export interface HitEvent {
  id: string;
  beatId: string;
  time: number;
  lane: number;
  kind: HitEventKind;
  pairedStartId?: string;
}

export interface EngineCallbacks {
  onJudgement?: (info: JudgementInfo) => void;
  onScore?: (score: number, combo: number) => void;
  onComboBreak?: () => void;
  onLevelComplete?: (result: ScoreResult) => void;
}

export interface JudgementInfo {
  judgement: Judgement;
  beatId: string;
  eventId: string;
  lane: number;
  earlyLate: "early" | "late" | "on";
  auto: boolean;
}

export interface EngineSnapshot {
  songPosition: number;
  score: number;
  combo: number;
  maxCombo: number;
  judgements: Judgement[];
  pendingEvents: HitEvent[];
  holdingLanes: Set<number>;
  finished: boolean;
}

/** Expand a level's beats into the flat hit-event list the engine judges. */
export function expandBeats(level: Level): HitEvent[] {
  const events: HitEvent[] = [];
  for (const beat of level.beats) {
    if (beat.type === "tap") {
      events.push({ id: `${beat.id}`, beatId: beat.id, time: beat.time, lane: beat.lane, kind: "tap" });
    } else if (beat.type === "hold") {
      const startId = `${beat.id}#s`;
      const endId = `${beat.id}#e`;
      const dur = beat.duration ?? 0;
      events.push({ id: startId, beatId: beat.id, time: beat.time, lane: beat.lane, kind: "hold-start" });
      events.push({ id: endId, beatId: beat.id, time: beat.time + dur, lane: beat.lane, kind: "hold-end", pairedStartId: startId });
    } else if (beat.type === "two-step") {
      const gap = beat.stepGap ?? 0;
      events.push({ id: `${beat.id}#1`, beatId: beat.id, time: beat.time, lane: beat.lane, kind: "tap" });
      events.push({ id: `${beat.id}#2`, beatId: beat.id, time: beat.time + gap, lane: beat.lane, kind: "tap" });
    }
  }
  return events;
}

export class GameEngine {
  private events: HitEvent[];
  private judged = new Set<string>();
  private holding = new Map<number, { beatId: string; endEventId: string }>();
  private judgementLog: Judgement[] = [];
  private combo = 0;
  private maxCombo = 0;
  private finished = false;
  private result: ScoreResult | null = null;

  constructor(
    private readonly level: Level,
    private readonly settings: Settings,
    private readonly getAudioTime: () => number,
    private readonly getSongStartAudioTime: () => number,
    private readonly callbacks: EngineCallbacks = {}
  ) {
    this.events = expandBeats(level).sort((a, b) => a.time - b.time);
  }

  get totalEvents(): number { return this.events.length; }
  get beatCount(): number { return this.level.beats.length; }

  onPress(lane: number, audioTime?: number): void {
    if (this.finished) return;
    const t = audioTime ?? this.getAudioTime();
    const lat = this.settings.latencyOffset;
    const start = this.getSongStartAudioTime();
    let best: HitEvent | null = null;
    let bestErr = Infinity;
    for (const ev of this.events) {
      if (this.judged.has(ev.id)) continue;
      if (ev.kind === "hold-end") continue;
      if (ev.lane !== lane) continue;
      const err = absError(t, ev.time, start, lat);
      if (err < bestErr && err <= GOOD_WINDOW * 1.5) { bestErr = err; best = ev; }
    }
    if (!best) return;
    const j = judgeTap(t, { ...placeholderBeat(best), time: best.time }, start, lat);
    this.recordJudgement(best, j, t, false);
    if (best.kind === "hold-start") {
      const endEvent = this.events.find((e) => e.kind === "hold-end" && e.pairedStartId === best!.id);
      if (endEvent) this.holding.set(lane, { beatId: best.beatId, endEventId: endEvent.id });
    }
  }

  onRelease(lane: number, audioTime?: number): void {
    if (this.finished) return;
    const held = this.holding.get(lane);
    if (!held) return;
    const t = audioTime ?? this.getAudioTime();
    const lat = this.settings.latencyOffset;
    const start = this.getSongStartAudioTime();
    const endEvent = this.events.find((e) => e.id === held.endEventId);
    if (!endEvent) { this.holding.delete(lane); return; }
    const beat = this.level.beats.find((b) => b.id === held.beatId);
    const j = beat ? judgeHoldRelease(t, beat, start, lat) : ("miss" as Judgement);
    this.recordJudgement(endEvent, j, t, false);
    this.holding.delete(lane);
  }

  update(): void {
    if (this.finished) return;
    const t = this.getAudioTime();
    const start = this.getSongStartAudioTime();
    const songPos = t - start;
    for (const ev of this.events) {
      if (this.judged.has(ev.id)) continue;
      if (ev.kind === "hold-end") {
        const isHolding = [...this.holding.values()].some((h) => h.endEventId === ev.id);
        if (isHolding) continue;
        const startJudged = ev.pairedStartId ? this.judged.has(ev.pairedStartId) : false;
        if (startJudged && songPos > ev.time + MISS_WINDOW) this.recordJudgement(ev, "miss", t, true);
        continue;
      }
      if (songPos > ev.time + MISS_WINDOW) this.recordJudgement(ev, "miss", t, true);
    }
    if (songPos > this.level.length + MISS_WINDOW && !this.finished) {
      for (const ev of this.events) if (!this.judged.has(ev.id)) this.recordJudgement(ev, "miss", t, true);
      this.finish();
    } else if (this.judged.size === this.events.length && !this.finished) {
      this.finish();
    }
  }

  abort(): ScoreResult {
    if (!this.finished) {
      const t = this.getAudioTime();
      for (const ev of this.events) if (!this.judged.has(ev.id)) this.recordJudgement(ev, "miss", t, true);
      this.finish();
    }
    return this.result!;
  }

  snapshot(): EngineSnapshot {
    const songPos = this.getAudioTime() - this.getSongStartAudioTime();
    return {
      songPosition: songPos,
      score: this.liveScore(),
      combo: this.combo,
      maxCombo: this.maxCombo,
      judgements: [...this.judgementLog],
      pendingEvents: this.events.filter((e) => !this.judged.has(e.id)),
      holdingLanes: new Set(this.holding.keys()),
      finished: this.finished,
    };
  }

  getFinalResult(): ScoreResult | null { return this.result; }

  private liveScore(): number {
    // Running score: aggregate the current judgement log each call.
    // Cheap enough for a vertical slice (a few hundred events max).
    return aggregateScore(this.judgementLog, this.beatCount).score;
  }

  private recordJudgement(ev: HitEvent, j: Judgement, audioTime: number, auto: boolean): void {
    if (this.judged.has(ev.id)) return;
    this.judged.add(ev.id);
    this.judgementLog.push(j);
    if (j === "miss") {
      if (this.combo > 0) this.callbacks.onComboBreak?.();
      this.combo = 0;
    } else {
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }
    this.callbacks.onJudgement?.({
      judgement: j,
      beatId: ev.beatId,
      eventId: ev.id,
      lane: ev.lane,
      earlyLate: earlyLate(audioTime, ev.time, this.getSongStartAudioTime(), this.settings.latencyOffset),
      auto,
    });
    this.callbacks.onScore?.(aggregateScore(this.judgementLog, this.beatCount).score, this.combo);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.result = aggregateScore(this.judgementLog, this.beatCount);
    this.callbacks.onLevelComplete?.(this.result);
  }
}

function placeholderBeat(ev: HitEvent): Beat {
  return { id: ev.beatId, time: ev.time, lane: ev.lane, type: "tap", ingredient: 0 };
}
