// Stage definitions and progression.
//
// Three challenge stages with increasing difficulty, plus a sandbox stage.
// Difficulty scales along three independent axes so the progression is
// meaningful, not just "faster":
//   1. number of planets (cognitive load / polyrhythm complexity)
//   2. orbital speed (denser note chart, less reaction time)
//   3. judgement window width (tighter timing tolerance)
//
// Orbital periods are chosen so the polyrhythms are musical rather than
// chaotic. Easy uses simple ratios (2:1, 3:2). Normal introduces a 4:3.
// Hard layers a 5:4 over a 7:4 for genuine cross-rhythms.

import type { PlanetConfig, StageConfig } from "./types";

const PALETTE = {
  star: "#ffe9a8",
  planet1: "#66FCF1",
  planet2: "#d6ff3f",
  planet3: "#ff7eb6",
  planet4: "#8b5cff",
  planet5: "#2fd57a",
};

const KEYS = ["a", "s", "d", "f", "g"];
const LABELS = ["I", "II", "III", "IV", "V"];

function planet(
  id: number,
  radius: number,
  period: number,
  startAngle: number,
  color: string,
  instrument: PlanetConfig["instrument"],
): PlanetConfig {
  return {
    id,
    radius,
    period,
    startAngle,
    color,
    key: KEYS[id - 1],
    instrument,
    label: LABELS[id - 1],
  };
}

// Stage 1 — Easy: two planets, slow, generous windows.
// Periods 4s and 2s -> 2:1 ratio, simple and predictable.
export const EASY: StageConfig = {
  id: "stage-1-waltz",
  name: "I. First Waltz",
  difficulty: "easy",
  seed: 101,
  bpm: 60,
  duration: 32,
  targetScore: 1200,
  windows: { perfect: 60, great: 110, good: 160 },
  planets: [
    planet(1, 110, 4, 0, PALETTE.planet1, "bell"),
    planet(2, 180, 2, Math.PI / 3, PALETTE.planet2, "pluck"),
  ],
};

// Stage 2 — Normal: three planets, medium tempo, tighter windows.
// Periods 3s, 2s, 1.5s -> 6:4:3 ratio, a 4:3 cross-rhythm emerges.
export const NORMAL: StageConfig = {
  id: "stage-2-crossing",
  name: "II. Crossing Currents",
  difficulty: "normal",
  seed: 202,
  bpm: 80,
  duration: 36,
  targetScore: 2400,
  windows: { perfect: 45, great: 85, good: 130 },
  planets: [
    planet(1, 100, 3, 0, PALETTE.planet1, "bell"),
    planet(2, 165, 2, Math.PI / 2, PALETTE.planet2, "pluck"),
    planet(3, 230, 1.5, Math.PI, PALETTE.planet3, "chime"),
  ],
};

// Stage 3 — Hard: four planets, fast, tight windows.
// Periods 2.8s, 2s, 1.6s, 1.12s -> 5:4 cross-rhythm plus a 7:4 layer.
export const HARD: StageConfig = {
  id: "stage-3-convergence",
  name: "III. Convergence",
  difficulty: "hard",
  seed: 303,
  bpm: 100,
  duration: 40,
  targetScore: 4200,
  windows: { perfect: 35, great: 70, good: 110 },
  planets: [
    planet(1, 95, 2.8, 0, PALETTE.planet1, "bell"),
    planet(2, 150, 2, Math.PI / 4, PALETTE.planet2, "pluck"),
    planet(3, 210, 1.6, Math.PI / 2, PALETTE.planet3, "chime"),
    planet(4, 275, 1.12, Math.PI, PALETTE.planet4, "pad"),
  ],
};

// Sandbox — free play. Five planets with distinct periods. The player can
// reassign instruments and adjust each planet's speed at runtime. No
// target score, no fail state.
export const SANDBOX: StageConfig = {
  id: "sandbox",
  name: "Sandbox",
  difficulty: "sandbox",
  seed: 999,
  bpm: 90,
  duration: 0, // 0 = unlimited
  targetScore: 0,
  windows: { perfect: 60, great: 110, good: 160 },
  planets: [
    planet(1, 95, 3.2, 0, PALETTE.planet1, "bell"),
    planet(2, 150, 2.4, Math.PI / 3, PALETTE.planet2, "pluck"),
    planet(3, 205, 1.9, (2 * Math.PI) / 3, PALETTE.planet3, "chime"),
    planet(4, 260, 1.4, Math.PI, PALETTE.planet4, "pad"),
    planet(5, 315, 1.0, (4 * Math.PI) / 3, PALETTE.planet5, "bass"),
  ],
};

export const STAGES: StageConfig[] = [EASY, NORMAL, HARD, SANDBOX];

export const CHALLENGE_STAGES = STAGES.filter((s) => s.difficulty !== "sandbox");

export function getStageById(id: string): StageConfig | undefined {
  return STAGES.find((s) => s.id === id);
}

/** Default instrument assignment used by the sandbox when the player has
 * not customized anything. Exposed for the sandbox controls UI. */
export const INSTRUMENT_ORDER: PlanetConfig["instrument"][] = [
  "bell",
  "pluck",
  "chime",
  "pad",
  "bass",
];
