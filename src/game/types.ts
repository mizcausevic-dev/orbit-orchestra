// Core shared types for Orbit Orchestra.
// These are intentionally free of DOM / Web Audio dependencies so the
// scheduling, scoring, and progression logic can be unit-tested in isolation.

export type Difficulty = "easy" | "normal" | "hard" | "sandbox";

export type Judgement = "perfect" | "great" | "good" | "miss";

/** Timing windows in milliseconds, applied to the absolute delta between
 * the player's perceived input time and the scheduled event time. */
export interface JudgementWindows {
  perfect: number;
  great: number;
  good: number;
}

/** Identifier for a synthesized instrument. Each maps to an oscillator type
 * and a base frequency inside the AudioEngine. */
export type InstrumentId =
  | "bell"
  | "pluck"
  | "pad"
  | "bass"
  | "chime";

export interface PlanetConfig {
  id: number;
  /** Orbit radius in display units (canvas pixels relative to center). */
  radius: number;
  /** Orbital period in seconds for one full revolution. */
  period: number;
  /** Starting angle in radians at t = 0. */
  startAngle: number;
  /** Display color as a CSS color string. */
  color: string;
  /** Keyboard key (lowercase KeyboardEvent.key) the player presses for this planet. */
  key: string;
  /** Synthesized instrument triggered on a clean hit. */
  instrument: InstrumentId;
  /** Display label, e.g. "I", "II", "III". */
  label: string;
}

export interface StageConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** Seed for any randomized decoration. Event generation itself is fully
   * deterministic from the planet periods and start angles. */
  seed: number;
  planets: PlanetConfig[];
  /** Stage length in seconds. */
  duration: number;
  windows: JudgementWindows;
  /** Beats per minute, used for the metronome and HUD only. */
  bpm: number;
  /** Optional target score shown on the result screen (0 = no target). */
  targetScore: number;
}

export interface ScheduledEvent {
  /** Absolute game time in seconds when the planet crosses the beat line. */
  time: number;
  planetId: number;
  /** Beat-line angle in radians (constant per stage, stored for rendering). */
  angle: number;
}

export type GamePhase =
  | "title"
  | "instructions"
  | "tutorial"
  | "playing"
  | "paused"
  | "result";

export interface HitResult {
  judgement: Judgement;
  deltaMs: number;
  planetId: number;
  /** Audio time of the perceived input. */
  inputTime: number;
}

export interface StageResult {
  stageId: string;
  score: number;
  maxCombo: number;
  counts: Record<Judgement, number>;
  totalEvents: number;
  accuracy: number;
  cleared: boolean;
}

export interface Settings {
  muted: boolean;
  /** Visual-only cue mode: no audio is scheduled, gameplay is judged from
   * visual timing alone. Useful for silent environments and accessibility. */
  visualOnly: boolean;
  /** User-adjustable latency offset in milliseconds. Subtracted from the
   * raw input time so perceived input lines up with the scheduled event. */
  latencyOffsetMs: number;
  /** Disables animated motion and replaces it with static indicators. */
  reducedMotion: boolean;
  /** Master volume 0..1. */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  visualOnly: false,
  latencyOffsetMs: 0,
  reducedMotion: false,
  volume: 0.7,
};

export const STORAGE_PREFIX =
  (import.meta.env.VITE_STORAGE_PREFIX as string | undefined) ?? "orbit-orchestra";
