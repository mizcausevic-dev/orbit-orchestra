// Low-level synth voices built on the Web Audio API.
//
// All sounds are synthesized at runtime from oscillators and noise bursts.
// No audio files are loaded, so there are no third-party audio rights to clear.
// Every voice schedules itself against AudioContext.currentTime so timing is
// sample-accurate and independent of the main thread / animation frame.

export type VoiceKind = "melody" | "bass" | "kick" | "hat" | "snare" | "ping";

interface VoiceOptions {
  /** Absolute audio clock time to start the voice. */
  when: number;
  /** Frequency in Hz for pitched voices. Ignored for noise voices. */
  freq?: number;
  /** Duration in seconds. */
  duration: number;
  /** 0..1 peak gain. */
  gain?: number;
}

/**
 * A small synth wrapper around an AudioContext. One instance per game session.
 * Methods are safe to call from the scheduling loop; they create short-lived
 * nodes and let the GC clean them up.
 */
export class Synth {
  constructor(private ctx: AudioContext) {}

  /** Play a pitched voice with an ADSR-ish envelope. */
  note(kind: "melody" | "bass" | "ping", opts: VoiceOptions): void {
    const { when, duration, gain = 0.6 } = opts;
    const freq = opts.freq ?? 440;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = kind === "bass" ? "sawtooth" : kind === "ping" ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, when);
    if (kind === "ping") {
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, when + duration);
    }
    // ADSR envelope: fast attack, gentle decay/release.
    const peak = kind === "bass" ? gain * 0.7 : gain;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(env);
    // A gentle lowpass for warmth.
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = kind === "bass" ? 600 : 2200;
    env.connect(filter);
    filter.connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  /** Play a kick drum: sine sweep down + fast decay. */
  kick(opts: VoiceOptions): void {
    const { when, gain = 0.9 } = opts;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    osc.connect(env);
    env.connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + 0.25);
  }

  /** Play a hi-hat: short white-noise burst through a highpass filter. */
  hat(opts: VoiceOptions): void {
    const { when, gain = 0.3 } = opts;
    const buffer = this.noiseBuffer(0.05);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.ctx.destination);
    src.start(when);
    src.stop(when + 0.05);
  }

  /** Play a snare: noise + a body tone. */
  snare(opts: VoiceOptions): void {
    const { when, gain = 0.5 } = opts;
    const buffer = this.noiseBuffer(0.2);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.ctx.destination);
    src.start(when);
    src.stop(when + 0.2);
  }

  /** Dispatch a voice by kind. Used by the scheduler. */
  play(kind: VoiceKind, opts: VoiceOptions): void {
    switch (kind) {
      case "melody":
      case "ping":
        this.note(kind, opts);
        break;
      case "bass":
        this.note("bass", opts);
        break;
      case "kick":
        this.kick(opts);
        break;
      case "hat":
        this.hat(opts);
        break;
      case "snare":
        this.snare(opts);
        break;
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

/** Convert a semitone offset from A4 (440Hz) into a frequency. */
export function semitoneToFreq(semitones: number): number {
  return 440 * Math.pow(2, semitones / 12);
}
