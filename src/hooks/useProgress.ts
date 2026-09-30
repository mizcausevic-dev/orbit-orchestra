// Player progress: best score per stage and which stages are unlocked.
//
// Progression rule: clearing a challenge stage (score >= targetScore) unlocks
// the next challenge stage. Sandbox is always available. Progress is
// persisted to localStorage and survives reloads. No data ever leaves the
// device: there is no backend and no analytics on stage results.

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_PREFIX, type StageResult } from "../game/types";
import { CHALLENGE_STAGES, getStageById } from "../game/stages";

const PROGRESS_KEY = `${STORAGE_PREFIX}:progress:v1`;

export interface ProgressState {
  /** Best score per stage id. */
  best: Record<string, number>;
  /** Highest unlocked challenge stage index (0-based). Sandbox is always
   * unlocked and not tracked here. */
  unlockedIndex: number;
  /** Whether the player has completed the tutorial at least once. */
  tutorialDone: boolean;
}

const INITIAL: ProgressState = {
  best: {},
  unlockedIndex: 0,
  tutorialDone: false,
};

export interface ProgressApi {
  progress: ProgressState;
  recordResult: (result: StageResult) => void;
  isUnlocked: (stageId: string) => boolean;
  markTutorialDone: () => void;
  reset: () => void;
}

export function useProgress(): ProgressApi {
  const [progress, setProgress] = useLocalStorage<ProgressState>(
    PROGRESS_KEY,
    INITIAL,
  );

  const recordResult = useCallback(
    (result: StageResult) => {
      setProgress((prev) => {
        const best = { ...prev.best };
        const prevBest = best[result.stageId] ?? 0;
        best[result.stageId] = Math.max(prevBest, result.score);

        let unlockedIndex = prev.unlockedIndex;
        if (result.cleared) {
          const idx = CHALLENGE_STAGES.findIndex((s) => s.id === result.stageId);
          if (idx >= 0) {
            unlockedIndex = Math.max(unlockedIndex, idx + 1);
            // Clamp to the number of challenge stages so the index stays valid.
            unlockedIndex = Math.min(unlockedIndex, CHALLENGE_STAGES.length - 1);
          }
        }

        return { ...prev, best, unlockedIndex };
      });
    },
    [setProgress],
  );

  const isUnlocked = useCallback(
    (stageId: string) => {
      const stage = getStageById(stageId);
      if (!stage) return false;
      if (stage.difficulty === "sandbox") return true;
      const idx = CHALLENGE_STAGES.findIndex((s) => s.id === stageId);
      return idx >= 0 && idx <= progress.unlockedIndex;
    },
    [progress.unlockedIndex],
  );

  const markTutorialDone = useCallback(() => {
    setProgress((prev) => (prev.tutorialDone ? prev : { ...prev, tutorialDone: true }));
  }, [setProgress]);

  const reset = useCallback(() => setProgress(INITIAL), [setProgress]);

  return useMemo(
    () => ({ progress, recordResult, isUnlocked, markTutorialDone, reset }),
    [progress, recordResult, isUnlocked, markTutorialDone, reset],
  );
}
