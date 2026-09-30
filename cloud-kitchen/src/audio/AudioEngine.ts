// AudioEngine — the single owner of the AudioContext and the music scheduler.
//
// Responsibilities:
//   - Create the AudioContext lazily on first user gesture (autoplay policy).
//   - Schedule all music events ahead of time against AudioContext.currentTime
//     using a look-ahead window. This is the "A Tale of Two Clocks" pattern.
//   - Expose a monotonic song-position clock for the game loop and scoring.
//   - Handle mute, volume, visual-only mode, pause/resume, and stop.
//
// The engine never reads Date.now() or performance.now() for musical timing.
// All scheduling and song-position queries go through AudioContext.currentTime.

import { generateMusic, type MusicEvent } from "./MusicGenerator";
import { Synth } from "./Synth";
import type { Level } from "../game/types";

const LOOKAHEAD_MS = 25; // how often the scheduler wakes
const SCHEDULE_AHEAD_S = 0.1; // schedule events up to 100ms in the future

export interface AudioEngineCallbacks {
  /** Called when a music event is scheduled (for visual-only sync if needed). */
  onScheduled?: (events: MusicEvent[]) => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private masterGain: GainNode | null = null;
  private events: MusicEvent[] = [];
  private nextEventIndex = 0;
  private songStartAudioTime = 0;
  private schedulerTimer: number | null = null;
  private pausedAtSongPos: number | null = null;
  private muted = false;
  private visualOnly = false;
  private volume = 0.8;

  /** True if the AudioContext has been created and is running. */
  get isReady(): boolean {
    return this.ctx != null && this.ctx.state === "running";
  }

  /**
   * Create and resume the AudioContext. Must be called from a user gesture
   * (click, keydown) to satisfy autoplay policies. Idempotent.
   */
  async unlock(): Promise<void> {
    if (this.ctx == null) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.synth = new Synth(this.ctx);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime
      );
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  setVisualOnly(on: boolean): void {
    this.visualOnly = on;
  }

  /**
   * Begin a level. Generates the music, sets the song start time, and starts
   * the scheduler. The song body starts at AudioContext.currentTime + leadIn.
   */
  start(level: Level): void {
    if (!this.ctx || !this.synth || !this.masterGain) {
      throw new Error("AudioEngine.start called before unlock().");
    }
    this.events = generateMusic(level);
    this.nextEventIndex = 0;
    this.pausedAtSongPos = null;
    this.songStartAudioTime = this.ctx.currentTime + level.leadIn;
    this.startScheduler();
  }

  /** Pause the song. Song position freezes at the current audio time. */
  pause(): void {
    if (this.pausedAtSongPos != null) return;
    this.pausedAtSongPos = this.getSongPosition();
    this.stopScheduler();
    if (this.ctx) {
      void this.ctx.suspend();
    }
  }

  /** Resume from pause. Shifts songStartAudioTime so the position is continuous. */
  resume(): void {
    if (this.pausedAtSongPos == null || !this.ctx) return;
    void this.ctx.resume().then(() => {
      if (!this.ctx) return;
      // Keep the song position continuous: new start = now - pausedPos.
      this.songStartAudioTime = this.ctx.currentTime - this.pausedAtSongPos!;
      this.pausedAtSongPos = null;
      this.startScheduler();
    });
  }

  /** Stop and reset. Does not close the context (so it can be reused). */
  stop(): void {
    this.stopScheduler();
    this.events = [];
    this.nextEventIndex = 0;
    this.pausedAtSongPos = null;
  }

  /** Close the AudioContext entirely. Used on teardown. */
  async close(): Promise<void> {
    this.stop();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
      this.synth = null;
      this.masterGain = null;
    }
  }

  /**
   * Current song position in seconds. Returns 0 before start, the frozen
   * position during pause, and the live position during play. Negative values
   * occur during the lead-in (before the first beat).
   */
  getSongPosition(): number {
    if (this.pausedAtSongPos != null) return this.pausedAtSongPos;
    if (!this.ctx || this.songStartAudioTime === 0) return 0;
    return this.ctx.currentTime - this.songStartAudioTime;
  }

  /** The raw AudioContext currentTime. Used by the engine for input timestamps. */
  getAudioTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** The absolute audio time the song started. 0 before start. */
  getSongStartAudioTime(): number {
    return this.songStartAudioTime;
  }

  /** Play a short hit-confirm sound. Used for tap feedback. */
  playHitPing(): void {
    if (!this.ctx || !this.synth || this.muted || this.visualOnly) return;
    this.synth.play("ping", {
      when: this.ctx.currentTime,
      freq: 880,
      duration: 0.08,
      gain: 0.3,
    });
  }

  /** Play a scheduled ping at an absolute audio time. Used by calibration. */
  playHitPingAt(when: number, freq = 880): void {
    if (!this.ctx || !this.synth || this.muted || this.visualOnly) return;
    this.synth.play("ping", { when, freq, duration: 0.08, gain: 0.3 });
  }

  private startScheduler(): void {
    if (this.schedulerTimer != null) return;
    this.schedulerTimer = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer != null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private tick(): void {
    if (!this.ctx || !this.synth) return;
    const now = this.ctx.currentTime;
    const horizon = now + SCHEDULE_AHEAD_S;
    while (
      this.nextEventIndex < this.events.length &&
      this.eventAudioTime(this.events[this.nextEventIndex]) < horizon
    ) {
      const event = this.events[this.nextEventIndex];
      const when = this.eventAudioTime(event);
      if (when >= now) {
        if (!this.muted && !this.visualOnly) {
          this.synth.play(event.kind, {
            when,
            freq: event.freq,
            duration: event.duration,
            gain: event.gain,
          });
        }
      }
      this.nextEventIndex++;
    }
  }

  private eventAudioTime(event: MusicEvent): number {
    return this.songStartAudioTime + event.time;
  }

  /** For tests: the full music event list for the current song. */
  getEvents(): MusicEvent[] {
    return this.events;
  }
}
