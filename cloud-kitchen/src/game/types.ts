// Core shared types for Cloud Kitchen.
// All timing values are in seconds relative to AudioContext.currentTime unless
// otherwise noted. The game never judges from CSS or animation time; the
// AudioContext clock is the single source of truth for scoring.

/** A single beat the player must hit. */
export interface Beat {
  /** Unique, stable id within a level. Used as a React key and for scoring maps. */
  id: string;
  /** Beat time, in seconds, measured from the start of the song (audio clock). */
  time: number;
  /** Which lane / arc the ingredient travels down. 0-indexed. */
  lane: number;
  /** Pattern type. */
  type: BeatType;
  /** For HOLD beats: the sustain duration in seconds. The player must hold
   *  the input from `time` to `time + duration`. */
  duration?: number;
  /** For TWO_STEP beats: the gap in seconds between the first and second hit.
   *  The second hit is judged at `time + stepGap`. */
  stepGap?: number;
  /** Ingredient visual. Indexes into the renderer's ingredient palette. */
  ingredient: number;
}

export type BeatType = "tap" | "hold" | "two-step";

export type Judgement = "perfect" | "great" | "good" | "miss";

export interface Level {
  /** Schema version. Bumped on breaking changes to the level format. */
  schemaVersion: number;
  /** Stable id. Used for progress persistence. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Difficulty label for the picker. */
  difficulty: "Easy" | "Medium" | "Hard" | "Custom";
  /** Beats per minute. Drives both music and beat scheduling. */
  bpm: number;
  /** Musical key root, semitones from A4 (440Hz). 0 = A4. */
  key: number;
  /** Scale degrees used by the music generator. 0 = root. */
  scale: number[];
  /** Seconds of lead-in before the first beat. Gives the player time to read. */
  leadIn: number;
  /** Total song length in seconds. Beats after this are ignored. */
  length: number;
  /** Lanes the player can hit. 1..4. */
  lanes: number;
  /** PRNG seed for deterministic music generation. */
  seed: number;
  /** The beats themselves. */
  beats: Beat[];
  /** Optional author credit shown in the UI. */
  author?: string;
}

export interface ScoreResult {
  /** Sum of judgement weights. 1_000_000 max for a perfect full clear. */
  score: number;
  /** Per-judgement counts. */
  judgements: Record<Judgement, number>;
  /** Maximum combo reached. */
  maxCombo: number;
  /** 0..1 fraction of beats hit (anything not miss). */
  accuracy: number;
  /** Letter grade S/A/B/C/D. */
  grade: Grade;
  /** True if every beat was perfect or great. */
  fullCombo: boolean;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

export type GamePhase =
  | "title"
  | "instructions"
  | "level-select"
  | "playing"
  | "paused"
  | "result"
  | "builder"
  | "settings";

export interface Settings {
  /** User latency offset in seconds. Subtracted from input time before judging. */
  latencyOffset: number;
  /** Mute all audio. */
  muted: boolean;
  /** Visual-only mode: no audio cues, beats still judged on input timing. */
  visualOnly: boolean;
  /** Honor prefers-reduced-motion. When true, arcs are flattened and animations are minimal. */
  reducedMotion: boolean;
  /** Master volume 0..1. */
  volume: number;
}

export interface LevelProgress {
  /** Best score per level id. */
  best: Record<string, number>;
  /** Best grade per level id. */
  bestGrade: Record<string, Grade>;
  /** Levels the player has cleared at least once. */
  cleared: string[];
}
