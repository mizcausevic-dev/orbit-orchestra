import { describe, it, expect } from "vitest";
import {
  judge,
  scoreFor,
  comboMultiplier,
  tallyResults,
  nearestEvent,
} from "../src/game/scoring";
import type { HitResult, JudgementWindows, ScheduledEvent } from "../src/game/types";

const WINDOWS: JudgementWindows = { perfect: 40, great: 80, good: 120 };

describe("judge", () => {
  it("returns perfect within the perfect window (inclusive)", () => {
    expect(judge(0, WINDOWS)).toBe("perfect");
    expect(judge(40, WINDOWS)).toBe("perfect");
    expect(judge(-40, WINDOWS)).toBe("perfect");
  });

  it("returns great between perfect and great windows", () => {
    expect(judge(41, WINDOWS)).toBe("great");
    expect(judge(80, WINDOWS)).toBe("great");
    expect(judge(-80, WINDOWS)).toBe("great");
  });

  it("returns good between great and good windows", () => {
    expect(judge(81, WINDOWS)).toBe("good");
    expect(judge(120, WINDOWS)).toBe("good");
    expect(judge(-120, WINDOWS)).toBe("good");
  });

  it("returns miss outside the good window", () => {
    expect(judge(121, WINDOWS)).toBe("miss");
    expect(judge(-121, WINDOWS)).toBe("miss");
    expect(judge(1000, WINDOWS)).toBe("miss");
  });
});

describe("scoreFor", () => {
  it("scores perfect > great > good > miss", () => {
    expect(scoreFor("perfect")).toBeGreaterThan(scoreFor("great"));
    expect(scoreFor("great")).toBeGreaterThan(scoreFor("good"));
    expect(scoreFor("good")).toBeGreaterThan(scoreFor("miss"));
    expect(scoreFor("miss")).toBe(0);
  });
});

describe("comboMultiplier", () => {
  it("is 1 at combo 0 and 1", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
  });

  it("grows by 0.1 per combo step and caps at 2", () => {
    expect(comboMultiplier(2)).toBeCloseTo(1.1);
    expect(comboMultiplier(11)).toBe(2);
    expect(comboMultiplier(50)).toBe(2);
  });
});

describe("tallyResults", () => {
  it("counts judgements, applies combo multiplier, and computes accuracy", () => {
    const hits: HitResult[] = [
      { judgement: "perfect", deltaMs: 5, planetId: 1, inputTime: 1 },
      { judgement: "perfect", deltaMs: 10, planetId: 1, inputTime: 2 },
      { judgement: "great", deltaMs: 50, planetId: 1, inputTime: 3 },
      { judgement: "miss", deltaMs: 200, planetId: 1, inputTime: 4 },
    ];
    const r = tallyResults(hits, 5, 0);
    expect(r.counts.perfect).toBe(2);
    expect(r.counts.great).toBe(1);
    expect(r.counts.good).toBe(0);
    // 1 miss recorded + 1 unhit event => 2 misses
    expect(r.counts.miss).toBe(2);
    expect(r.maxCombo).toBe(3);
    // score: 100*1 + 100*1.1 + 60*1.2 = 100 + 110 + 72 = 282
    expect(r.score).toBe(282);
    // accuracy: (100+100+60) / (5*100) = 260/500 = 0.52
    expect(r.accuracy).toBeCloseTo(0.52);
  });

  it("clears when score meets target", () => {
    const hits: HitResult[] = [
      { judgement: "perfect", deltaMs: 0, planetId: 1, inputTime: 0 },
    ];
    const r = tallyResults(hits, 1, 100);
    expect(r.cleared).toBe(true);
  });

  it("does not clear when below target", () => {
    const hits: HitResult[] = [];
    const r = tallyResults(hits, 1, 100);
    expect(r.cleared).toBe(false);
  });
});

describe("nearestEvent", () => {
  const events: ScheduledEvent[] = [
    { time: 1.0, planetId: 1, angle: -Math.PI / 2 },
    { time: 2.0, planetId: 1, angle: -Math.PI / 2 },
    { time: 2.5, planetId: 2, angle: -Math.PI / 2 },
  ];
  const judged = new Set<number>();

  it("finds the closest event for a planet within the good window", () => {
    const m = nearestEvent(events, 1, 1.05, WINDOWS, judged);
    expect(m?.index).toBe(0);
    expect(m?.deltaMs).toBeCloseTo(50);
  });

  it("returns null when nothing is within the good window", () => {
    const m = nearestEvent(events, 1, 5.0, WINDOWS, judged);
    expect(m).toBeNull();
  });

  it("skips already-judged events", () => {
    const judged2 = new Set<number>([0]);
    // Input near event index 1 (t=2.0); event 0 is judged so it is skipped.
    const m = nearestEvent(events, 1, 2.05, WINDOWS, judged2);
    expect(m?.index).toBe(1);
  });

  it("ignores events for other planets", () => {
    const m = nearestEvent(events, 2, 1.0, WINDOWS, judged);
    expect(m).toBeNull();
  });
});
