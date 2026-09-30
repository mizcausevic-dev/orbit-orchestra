// Deterministic music generator.
//
// Given a level, produces a list of scheduled note events aligned to the beat
// grid. The same seed always produces the same sequence, so seed-reproducibility
// tests can assert exact equality. Output is a flat list of events that the
// AudioEngine schedules against AudioContext.currentTime.

import { mulberry32 } from "../game/seed";
import { secondsPerBeat } from "../game/timing";
import type { Level } from "../game/types";
import { semitoneToFreq } from "./Synth";

export type MusicEventKind =
  | "kick"
  | "hat"
  | "snare"
  | "bass"
  | "melody"
  | "ping";

export interface MusicEvent {
  /** Voice kind. */
  kind: MusicEventKind;
  /** Song-relative start time in seconds. */
  time: number;
  /** Frequency in Hz for pitched voices. 0 for percussion. */
  freq: number;
  /** Duration in seconds. */
  duration: number;
  /** 0..1 gain. */
  gain: number;
}

/**
 * Generate the full music event list for a level. Deterministic.
 * The music is intentionally simple: a four-on-the-floor kick, hats on the
 * off-beats, a bassline on the root, and a pentatonic-flavored melody that
 * drifts above it. The melody uses the level's scale and key.
 */
export function generateMusic(level: Level): MusicEvent[] {
  const rng = mulberry32(level.seed ^ 0x5e3a);
  const spb = secondsPerBeat(level.bpm);
  const totalBeats = Math.floor(level.length / spb);
  const events: MusicEvent[] = [];

  // Note: the song "body" starts at song position 0. The AudioEngine adds the
  // leadIn so all events are shifted by leadIn in audio-clock time.

  for (let b = 0; b < totalBeats; b++) {
    const t = b * spb;
    const beatInBar = b % 4;

    // Kick on every beat (four-on-the-floor).
    events.push({ kind: "kick", time: t, freq: 0, duration: 0.2, gain: 0.9 });
    // Hat on the off-beats (the "&" of each beat).
    events.push({
      kind: "hat",
      time: t + spb / 2,
      freq: 0,
      duration: 0.04,
      gain: 0.25,
    });
    // Snare on beats 2 and 4.
    if (beatInBar === 1 || beatInBar === 3) {
      events.push({ kind: "snare", time: t, freq: 0, duration: 0.18, gain: 0.5 });
    }
    // Bass on the root, one note per beat, with occasional movement.
    const bassDegree = beatInBar === 0 ? 0 : (rng() < 0.3 ? 4 : 0);
    const bassFreq = semitoneToFreq(
      level.key + level.scale[bassDegree % level.scale.length] - 12
    );
    events.push({
      kind: "bass",
      time: t,
      freq: bassFreq,
      duration: spb * 0.8,
      gain: 0.5,
    });
    // Melody: a note roughly every other beat, drawn from the scale.
    if (b % 2 === 0 || rng() < 0.4) {
      const degree = Math.floor(rng() * level.scale.length);
      const octave = rng() < 0.3 ? 12 : 0;
      const melodyFreq = semitoneToFreq(level.key + level.scale[degree] + octave);
      events.push({
        kind: "melody",
        time: t,
        freq: melodyFreq,
        duration: spb * 0.9,
        gain: 0.45,
      });
    }
  }

  // Sort by time so the scheduler can iterate with a single moving index.
  events.sort((a, b) => a.time - b.time);
  return events;
}
