// Scoring. Pure functions, no DOM, no audio. Fully deterministic and testable.
//
// Scoring model:
//   - Each beat has a base value of 1_000_000 / beatCount.
//   - The judgement weight scales that base value:
//       perfect = 1.0, great = 0.7, good = 0.4, miss = 0.0
//   - Combo multiplier: every 10 beats in a row adds 0.02 to a multiplier that
//     caps at 1.5. A miss resets the combo to 0.
//   - For HOLD beats, the release timing is judged as a second score event with
//     half weight. For TWO_STEP beats, the second hit is a full second event.
//   - Accuracy = (perfect + great + good) / total judged events.
//   - Grade thresholds on accuracy: S >= 0.95, A >= 0.85, B >= 0.7, C >= 0.5, else D.

import {
  GOOD_WINDOW,
  GREAT_WINDOW,
  PERFECT_WINDOW,
  absError,
  timingDelta,
} from "./timing";
import type { Beat, Grade, Judgement, ScoreResult } from "./types";

export const JUDGEMENT_WEIGHT: Record<Judgement, number> = {
  perfect: 1.0,
  great: 0.7,
  good: 0.4,
  miss: 0.0,
};

export const MAX_SCORE = 1_000_000;

/** Judge a single tap input against a beat. Returns the judgement. */
export function judgeTap(
  inputAudioTime: number,
  beat: Beat,
  songStartAudioTime: number,
  latencyOffset: number
): Judgement {
  const err = absError(
    inputAudioTime,
    beat.time,
    songStartAudioTime,
    latencyOffset
  );
  return windowForError(err);
}

/** Judge a hold release. The release is judged against beat.time + beat.duration. */
export function judgeHoldRelease(
  releaseAudioTime: number,
  beat: Beat,
  songStartAudioTime: number,
  latencyOffset: number
): Judgement {
  if (beat.duration == null) return "miss";
  const releaseBeatTime = beat.time + beat.duration;
  const err = absError(
    releaseAudioTime,
    releaseBeatTime,
    songStartAudioTime,
    latencyOffset
  );
  return windowForError(err);
}

/** Judge the second hit of a two-step. Judged against beat.time + beat.stepGap. */
export function judgeTwoStepSecond(
  inputAudioTime: number,
  beat: Beat,
  songStartAudioTime: number,
  latencyOffset: number
): Judgement {
  if (beat.stepGap == null) return "miss";
  const secondBeatTime = beat.time + beat.stepGap;
  const err = absError(
    inputAudioTime,
    secondBeatTime,
    songStartAudioTime,
    latencyOffset
  );
  return windowForError(err);
}

function windowForError(err: number): Judgement {
  if (err <= PERFECT_WINDOW) return "perfect";
  if (err <= GREAT_WINDOW) return "great";
  if (err <= GOOD_WINDOW) return "good";
  return "miss";
}

/** Combo multiplier: 1.0 at combo 0, +0.02 per 10 beats, capped at 1.5. */
export function comboMultiplier(combo: number): number {
  const steps = Math.floor(combo / 10);
  return Math.min(1.0 + steps * 0.02, 1.5);
}

/**
 * Aggregate a list of judgements into a final ScoreResult.
 * `judgements` is the full ordered list of judgement events for the run,
 * including hold-release and two-step-second events.
 */
export function aggregateScore(
  judgements: Judgement[],
  beatCount: number
): ScoreResult {
  const counts: Record<Judgement, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  };
  let combo = 0;
  let maxCombo = 0;
  let weighted = 0;
  // Each judged event contributes an equal slice of MAX_SCORE, scaled by
  // its weight and the live combo multiplier.
  const perEvent = beatCount > 0 ? MAX_SCORE / judgements.length : 0;

  for (const j of judgements) {
    counts[j] += 1;
    if (j === "miss") {
      combo = 0;
    } else {
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
    }
    const mult = comboMultiplier(combo);
    weighted += perEvent * JUDGEMENT_WEIGHT[j] * mult;
  }

  const total = judgements.length;
  const hit = counts.perfect + counts.great + counts.good;
  const accuracy = total > 0 ? hit / total : 0;
  const score = Math.round(weighted);
  const grade = gradeFor(accuracy, counts.miss === 0);
  const fullCombo = counts.miss === 0 && total > 0;

  return {
    score,
    judgements: counts,
    maxCombo,
    accuracy,
    grade,
    fullCombo,
  };
}

export function gradeFor(accuracy: number, noMisses: boolean): Grade {
  // S requires both high accuracy and a full combo (no misses).
  if (noMisses && accuracy >= 0.95) return "S";
  if (accuracy >= 0.95) return "A";
  if (accuracy >= 0.85) return "A";
  if (accuracy >= 0.7) return "B";
  if (accuracy >= 0.5) return "C";
  return "D";
}

/**
 * Decide whether an input at `inputAudioTime` should be matched to a beat.
 * Returns the beat id of the nearest still-judgeable beat within MISS_WINDOW,
 * or null if nothing is close enough. Used by the engine to route taps.
 */
export function findNearestJudgeableBeat(
  inputAudioTime: number,
  beats: Beat[],
  songStartAudioTime: number,
  latencyOffset: number,
  alreadyJudged: Set<string>
): string | null {
  let bestId: string | null = null;
  let bestErr = Infinity;
  for (const beat of beats) {
    if (alreadyJudged.has(beat.id)) continue;
    const err = absError(
      inputAudioTime,
      beat.time,
      songStartAudioTime,
      latencyOffset
    );
    if (err < bestErr && err <= GOOD_WINDOW * 1.5) {
      bestErr = err;
      bestId = beat.id;
    }
  }
  return bestErr <= GOOD_WINDOW * 1.5 ? bestId : null;
}

/** Early/late label for UI feedback. Returns "early" | "late" | "on". */
export function earlyLate(
  inputAudioTime: number,
  beatTime: number,
  songStartAudioTime: number,
  latencyOffset: number
): "early" | "late" | "on" {
  const delta = timingDelta(
    inputAudioTime,
    beatTime,
    songStartAudioTime,
    latencyOffset
  );
  if (Math.abs(delta) <= PERFECT_WINDOW / 2) return "on";
  return delta > 0 ? "late" : "early";
}
