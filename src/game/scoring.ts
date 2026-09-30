// Scoring logic. Pure functions, no side effects, fully unit-testable.

import type { Judgement, JudgementWindows, HitResult, ScheduledEvent } from "./types";

/** Judge an absolute timing delta (in ms) against the supplied windows.
 * Returns the worst-case "miss" if the delta falls outside the good window. */
export function judge(deltaMs: number, windows: JudgementWindows): Judgement {
  const a = Math.abs(deltaMs);
  if (a <= windows.perfect) return "perfect";
  if (a <= windows.great) return "great";
  if (a <= windows.good) return "good";
  return "miss";
}

export function scoreFor(judgement: Judgement): number {
  switch (judgement) {
    case "perfect":
      return 100;
    case "great":
      return 60;
    case "good":
      return 30;
    case "miss":
      return 0;
  }
}

/** Combo multiplier applied to base score. Grows slowly so a long run is
 * rewarded but never explodes. Caps at 2x. */
export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  // +0.1 per combo step, capped at 2.0 (reached at combo 11).
  return Math.min(2, 1 + (combo - 1) * 0.1);
}

/** Find the nearest unjudged event for a given planet within the good
 * window. Returns null if nothing is close enough to be a valid hit, which
 * lets the caller register an "empty hit" (no penalty by default) or
 * ignore the input. */
export function nearestEvent(
  events: ScheduledEvent[],
  planetId: number,
  perceivedInputTimeSec: number,
  windows: JudgementWindows,
  alreadyJudged: Set<number>,
): { event: ScheduledEvent; index: number; deltaMs: number } | null {
  const goodWindowSec = windows.good / 1000;
  let best: { event: ScheduledEvent; index: number; deltaMs: number } | null = null;
  let bestAbs = Infinity;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.planetId !== planetId) continue;
    if (alreadyJudged.has(i)) continue;
    const deltaSec = perceivedInputTimeSec - e.time;
    const absSec = Math.abs(deltaSec);
    if (absSec > goodWindowSec) continue;
    if (absSec < bestAbs) {
      bestAbs = absSec;
      best = { event: e, index: i, deltaMs: deltaSec * 1000 };
    }
  }
  return best;
}

/** Aggregate raw hit results into final stage counts and accuracy. */
export function tallyResults(
  hits: HitResult[],
  totalEvents: number,
  targetScore: number,
): {
  counts: Record<Judgement, number>;
  score: number;
  maxCombo: number;
  accuracy: number;
  cleared: boolean;
  totalEvents: number;
} {
  const counts: Record<Judgement, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  };
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let weighted = 0;

  for (const h of hits) {
    counts[h.judgement] += 1;
    const base = scoreFor(h.judgement);
    if (h.judgement !== "miss") {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const mult = comboMultiplier(combo);
      score += Math.round(base * mult);
      weighted += base;
    } else {
      combo = 0;
    }
  }

  // Events that were never hit count as misses.
  const missedEvents = Math.max(0, totalEvents - hits.length);
  counts.miss += missedEvents;

  // Accuracy is weighted score over the maximum possible across ALL
  // events, so unhit events reduce accuracy. This matches what a player
  // expects: missing notes lowers the percentage.
  const accuracy = totalEvents === 0 ? 0 : weighted / (totalEvents * 100);
  const cleared = targetScore <= 0 || score >= targetScore;
  return { counts, score, maxCombo, accuracy, cleared, totalEvents };
}
