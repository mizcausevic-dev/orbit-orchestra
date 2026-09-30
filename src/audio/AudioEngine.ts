// AudioEngine: a thin wrapper around the Web Audio API.
//
// Responsibilities:
//   - Lazily create and resume the AudioContext on a user gesture (browsers
//     require this before any sound can play).
//   - Hold a master GainNode so mute and volume changes are atomic.
//   - Schedule instrument notes at absolute AudioContext.currentTime values
//     so timing is sample-accurate and independent of the main-thread frame
//     rate. This is the "lookahead scheduling" pattern: the game loop asks
//     the engine to play a note "at" a future audio time, and the engine
//     wires up the oscillator graph with setValueAtTime ramps so the note
//     actually sounds at that exact time.
//   - Respect mute and visual-only modes by skipping scheduling entirely.
//
// The engine does NOT own game logic. It is a pure audio sink driven by the
// game engine through callbacks.

import type { InstrumentId } from "../game/types";
import { INSTRUMENTS, semitone } from "./instruments";

type AudioContextCtor = typeof AudioContext;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private visualOnly = false;
  private volume = 0.7;
  private readonly ctxCtor: AudioContextCtor | null;

  constructor(ctxCtor?: AudioContextCtor) {
    // Allow injection for tests; fall back to the browser global at runtime.
    this.ctxCtor = ctxCtor ?? null;
  }

  private resolveCtor(): AudioContextCtor | null {
    if (this.ctxCtor) return this.ctxCtor;
    if (typeof window === "undefined") return null;
    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextCtor })
        .webkitAudioContext ||
      null
    );
  }

  /** Create / resume the context. Must be called from a user gesture. */
  async unlock(): Promise<void> {
    const Ctor = this.resolveCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  setVisualOnly(v: boolean): void {
    this.visualOnly = v;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    const target = this.muted || this.visualOnly ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
  }

  /** Schedule an instrument note at an absolute audio time `when` (seconds).
   * No-op if the context is missing, muted, or in visual-only mode. A small
   * semitone offset lets sandbox repeats stay musical instead of flat. */
  playInstrument(id: InstrumentId, when: number, semis = 0, velocity = 1): void {
    if (!this.ctx || !this.master) return;
    if (this.muted || this.visualOnly) return;
    const spec = INSTRUMENTS[id];
    const t = Math.max(when, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(semitone(spec.freq, semis), t);
    const peak = Math.max(0.0001, spec.gain * velocity);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + spec.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.attack + spec.decay);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + spec.attack + spec.decay + 0.05);
  }

  /** Short UI click for menu navigation and confirmation. */
  playClick(): void {
    if (!this.ctx || !this.master) return;
    if (this.muted || this.visualOnly) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(660, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** A soft metronome tick used by practice mode. */
  playMetronome(when: number): void {
    if (!this.ctx || !this.master) return;
    if (this.muted || this.visualOnly) return;
    const t = Math.max(when, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1500, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  async close(): Promise<void> {
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        // ignore double-close
      }
      this.ctx = null;
      this.master = null;
    }
  }
}
