// Built-in levels and the level schema validator used by the level builder.
//
// Beats are generated deterministically from each level's seed so the same
// level always plays the same way and tests can assert exact beat counts.
// The generator is intentionally simple and readable; it is not meant to
// produce chart-quality patterns, just consistent, playable ones.

import { mulberry32 } from "./seed";
import { secondsPerBeat } from "./timing";
import type { Beat, BeatType, Level } from "./types";

export const LEVEL_SCHEMA_VERSION = 1;

/** Ingredient palette indexes. The renderer maps these to drawn shapes. */
export const INGREDIENTS = [
  "egg",
  "bacon",
  "toast",
  "pancake",
  "blueberry",
  "butter",
  "syrup",
  "waffle",
] as const;

/** Generate beats for a level from its seed. Deterministic. */
export function generateBeats(level: Omit<Level, "beats">): Beat[] {
  const rng = mulberry32(level.seed);
  const spb = secondsPerBeat(level.bpm);
  const beats: Beat[] = [];
  // Start at beat 0 of the song body (after leadIn).
  const totalBeats = Math.floor(level.length / spb);
  let id = 0;
  let lastLane = -1;

  for (let b = 0; b < totalBeats; b++) {
    const time = b * spb;
    // Density ramp: earlier beats are sparser, later beats denser.
    const density = 0.4 + (b / Math.max(totalBeats, 1)) * 0.4;
    if (rng() > density) continue;

    // Pick a lane, avoiding immediate repeats when possible.
    let lane = Math.floor(rng() * level.lanes);
    if (level.lanes > 1 && lane === lastLane) {
      lane = (lane + 1) % level.lanes;
    }
    lastLane = lane;

    const ingredient = Math.floor(rng() * INGREDIENTS.length);
    const type = pickType(level.difficulty, rng);
    const beat: Beat = {
      id: `b${id++}`,
      time,
      lane,
      type,
      ingredient,
    };
    if (type === "hold") {
      // Hold for 0.5 to 2 beats.
      const beats = 0.5 + Math.floor(rng() * 3) * 0.5;
      beat.duration = beats * spb;
    } else if (type === "two-step") {
      // Second hit a quarter or half beat later.
      beat.stepGap = (rng() < 0.5 ? 0.25 : 0.5) * spb;
    }
    beats.push(beat);
  }
  return beats;
}

function pickType(
  difficulty: Level["difficulty"],
  rng: () => number
): BeatType {
  // Easy: tap only. Medium: tap + occasional hold. Hard: all three.
  if (difficulty === "Easy") return "tap";
  if (difficulty === "Medium") {
    return rng() < 0.2 ? "hold" : "tap";
  }
  // Hard / Custom
  const r = rng();
  if (r < 0.15) return "two-step";
  if (r < 0.35) return "hold";
  return "tap";
}

/** The three built-in levels. Beats are filled in lazily by buildLevel. */
const LEVEL_TEMPLATES: Omit<Level, "beats">[] = [
  {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: "ck-sunny-side-up",
    name: "Sunny Side Up",
    difficulty: "Easy",
    bpm: 90,
    key: 0,
    scale: [0, 2, 4, 5, 7, 9, 11], // major
    leadIn: 2.0,
    length: 32,
    lanes: 2,
    seed: 101,
    author: "Cloud Kitchen",
  },
  {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: "ck-bacon-wave",
    name: "Bacon Wave",
    difficulty: "Medium",
    bpm: 112,
    key: -2,
    scale: [0, 2, 3, 5, 7, 8, 10], // minor
    leadIn: 2.0,
    length: 40,
    lanes: 3,
    seed: 202,
    author: "Cloud Kitchen",
  },
  {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: "ck-pancake-stack",
    name: "Pancake Stack",
    difficulty: "Hard",
    bpm: 132,
    key: 2,
    scale: [0, 2, 3, 5, 7, 9, 11], // dorian-ish
    leadIn: 2.0,
    length: 48,
    lanes: 4,
    seed: 303,
    author: "Cloud Kitchen",
  },
];

/** Build a full Level (with beats) from a template. */
export function buildLevel(template: Omit<Level, "beats">): Level {
  return { ...template, beats: generateBeats(template) };
}

/** The three built-in levels, fully materialized. */
export const BUILT_IN_LEVELS: Level[] = LEVEL_TEMPLATES.map(buildLevel);

/** Find a built-in level by id. */
export function findLevel(id: string): Level | undefined {
  return BUILT_IN_LEVELS.find((l) => l.id === id);
}

// ---------------------------------------------------------------------------
// Level validation. Used by the builder before play and before share/export.
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_DIFFICULTIES = ["Easy", "Medium", "Hard", "Custom"];
const VALID_BEAT_TYPES = ["tap", "hold", "two-step"];

/** Validate a parsed level object. Returns ok=false with errors if invalid. */
export function validateLevel(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["Level must be a JSON object."], warnings };
  }
  const level = input as Partial<Level>;

  if (level.schemaVersion !== LEVEL_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${LEVEL_SCHEMA_VERSION} (got ${level.schemaVersion}).`
    );
  }
  if (typeof level.id !== "string" || level.id.length === 0) {
    errors.push("id must be a non-empty string.");
  }
  if (typeof level.name !== "string" || level.name.length === 0) {
    errors.push("name must be a non-empty string.");
  }
  if (!VALID_DIFFICULTIES.includes(level.difficulty ?? "")) {
    errors.push(
      `difficulty must be one of ${VALID_DIFFICULTIES.join(", ")} (got "${level.difficulty}").`
    );
  }
  if (typeof level.bpm !== "number" || level.bpm < 30 || level.bpm > 300) {
    errors.push("bpm must be a number between 30 and 300.");
  }
  if (typeof level.key !== "number" || level.key < -24 || level.key > 24) {
    warnings.push("key is outside the typical -24..24 range; it will still play.");
  }
  if (!Array.isArray(level.scale) || level.scale.length === 0) {
    errors.push("scale must be a non-empty array of semitone offsets.");
  }
  if (typeof level.leadIn !== "number" || level.leadIn < 0) {
    errors.push("leadIn must be a non-negative number.");
  }
  if (typeof level.length !== "number" || level.length <= 0) {
    errors.push("length must be a positive number.");
  }
  if (typeof level.lanes !== "number" || level.lanes < 1 || level.lanes > 4) {
    errors.push("lanes must be an integer between 1 and 4.");
  }
  if (typeof level.seed !== "number" || !Number.isFinite(level.seed)) {
    errors.push("seed must be a finite number.");
  }
  if (!Array.isArray(level.beats)) {
    errors.push("beats must be an array.");
  } else {
    const ids = new Set<string>();
    const songEnd = level.length ?? 0;
    for (let i = 0; i < level.beats.length; i++) {
      const beat = level.beats[i] as Partial<Beat>;
      const ctx = `beats[${i}]`;
      if (typeof beat.id !== "string" || beat.id.length === 0) {
        errors.push(`${ctx}.id must be a non-empty string.`);
      } else if (ids.has(beat.id)) {
        errors.push(`${ctx}.id "${beat.id}" is duplicated.`);
      } else {
        ids.add(beat.id);
      }
      if (typeof beat.time !== "number" || beat.time < 0) {
        errors.push(`${ctx}.time must be a non-negative number.`);
      } else if (beat.time > songEnd) {
        warnings.push(`${ctx}.time ${beat.time} exceeds level length.`);
      }
      if (typeof beat.lane !== "number" || beat.lane < 0 || beat.lane >= (level.lanes ?? 0)) {
        errors.push(
          `${ctx}.lane must be between 0 and ${Math.max(0, (level.lanes ?? 1) - 1)}.`
        );
      }
      if (!VALID_BEAT_TYPES.includes(beat.type ?? "")) {
        errors.push(`${ctx}.type must be one of ${VALID_BEAT_TYPES.join(", ")}.`);
      }
      if (beat.type === "hold" && (typeof beat.duration !== "number" || beat.duration <= 0)) {
        errors.push(`${ctx}.duration must be a positive number for hold beats.`);
      }
      if (beat.type === "two-step" && (typeof beat.stepGap !== "number" || beat.stepGap <= 0)) {
        errors.push(`${ctx}.stepGap must be a positive number for two-step beats.`);
      }
    }
    // Beats should be sorted by time for predictable playback.
    for (let i = 1; i < level.beats.length; i++) {
      const prev = (level.beats[i - 1] as Beat).time;
      const curr = (level.beats[i] as Beat).time;
      if (curr < prev) {
        warnings.push("beats are not sorted by time; they will be sorted on load.");
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Normalize a level: sort beats by time, clamp lane indexes. Defensive copy. */
export function normalizeLevel(level: Level): Level {
  const beats = [...level.beats]
    .map((b) => ({ ...b, lane: Math.max(0, Math.min(b.lane, level.lanes - 1)) }))
    .sort((a, b) => a.time - b.time);
  return { ...level, beats };
}

/** Encode a level to a URL-safe base64 string for sharing. UTF-8 safe. */
export function encodeLevel(level: Level): string {
  const json = JSON.stringify(level);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode a share code back into a level object. Throws on malformed input. */
export function decodeLevel(code: string): unknown {
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
