// Local persistence for settings and progress. Uses localStorage with a
// versioned key prefix so future schema changes can migrate cleanly.
//
// No PII is stored. No telemetry. Everything stays on the user's device.
// If localStorage is unavailable (private mode, SSR), the layer degrades
// gracefully to in-memory defaults.

import type { LevelProgress, Settings } from "../game/types";

const SETTINGS_KEY = "cloud-kitchen:settings:v1";
const PROGRESS_KEY = "cloud-kitchen:progress:v1";

export const DEFAULT_SETTINGS: Settings = {
  latencyOffset: 0,
  muted: false,
  visualOnly: false,
  reducedMotion: false,
  volume: 0.8,
};

export const EMPTY_PROGRESS: LevelProgress = {
  best: {},
  bestGrade: {},
  cleared: [],
};

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // localStorage can throw in private mode or when disabled.
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore write failures; the game still works in-memory for the session.
  }
}

export function loadSettings(): Settings {
  const raw = safeGet(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  safeSet(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadProgress(): LevelProgress {
  const raw = safeGet(PROGRESS_KEY);
  if (!raw) return { ...EMPTY_PROGRESS };
  try {
    const parsed = JSON.parse(raw) as Partial<LevelProgress>;
    return {
      best: parsed.best ?? {},
      bestGrade: parsed.bestGrade ?? {},
      cleared: parsed.cleared ?? [],
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveProgress(progress: LevelProgress): void {
  safeSet(PROGRESS_KEY, JSON.stringify(progress));
}

/** Record a completed run. Updates best score, best grade, and cleared list. */
export function recordResult(
  progress: LevelProgress,
  levelId: string,
  score: number,
  grade: string
): LevelProgress {
  const next: LevelProgress = {
    best: { ...progress.best },
    bestGrade: { ...progress.bestGrade },
    cleared: progress.cleared.includes(levelId)
      ? progress.cleared
      : [...progress.cleared, levelId],
  };
  if (progress.best[levelId] == null || score > progress.best[levelId]) {
    next.best[levelId] = score;
  }
  const gradeRank: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  const prevGrade = progress.bestGrade[levelId];
  if (prevGrade == null || (gradeRank[grade] ?? 0) > (gradeRank[prevGrade] ?? 0)) {
    next.bestGrade[levelId] = grade as LevelProgress["bestGrade"][string];
  }
  return next;
}
