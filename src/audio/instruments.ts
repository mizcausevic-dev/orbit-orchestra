// Synthesized instrument definitions for the Web Audio engine.
//
// Each instrument is an oscillator type plus a fixed base frequency and an
// ADSR-ish envelope. Frequencies are chosen to sit in distinct registers so
// the polyrhythm is audible and each planet has a recognizable voice. No
// melodies, no samples, no copyrighted material: every sound is a single
// oscillator with an envelope, generated at runtime.

import type { InstrumentId } from "../game/types";

export interface InstrumentSpec {
  type: OscillatorType;
  freq: number;
  attack: number;
  decay: number;
  /** Peak gain (0..1) before master volume. */
  gain: number;
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentSpec> = {
  bell: { type: "sine", freq: 880.0, attack: 0.004, decay: 0.9, gain: 0.5 },
  pluck: { type: "triangle", freq: 440.0, attack: 0.002, decay: 0.35, gain: 0.5 },
  chime: { type: "sine", freq: 1318.51, attack: 0.003, decay: 0.6, gain: 0.45 },
  pad: { type: "sawtooth", freq: 220.0, attack: 0.05, decay: 0.7, gain: 0.32 },
  bass: { type: "square", freq: 110.0, attack: 0.002, decay: 0.28, gain: 0.4 },
};

/** Detune a base frequency by a small number of semitones. Used to give
 * successive hits on the same planet a little variation in sandbox mode. */
export function semitone(freq: number, semis: number): number {
  return freq * Math.pow(2, semis / 12);
}
