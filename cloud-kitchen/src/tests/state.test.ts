// State / storage tests. Persistence and progress aggregation.
import { describe, expect, it, beforeEach } from "vitest";
import type { Grade } from "../game/types";
import {
  DEFAULT_SETTINGS,
  EMPTY_PROGRESS,
  loadProgress,
  loadSettings,
  recordResult,
  saveProgress,
  saveSettings,
} from "../state/storage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("settings persistence", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it("round-trips settings through localStorage", () => {
    const s = { ...DEFAULT_SETTINGS, latencyOffset: 0.05, muted: true, volume: 0.4 };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });
  it("merges partial stored settings with defaults", () => {
    window.localStorage.setItem("cloud-kitchen:settings:v1", JSON.stringify({ muted: true }));
    const loaded = loadSettings();
    expect(loaded.muted).toBe(true);
    expect(loaded.latencyOffset).toBe(DEFAULT_SETTINGS.latencyOffset);
  });
  it("falls back to defaults on corrupt JSON", () => {
    window.localStorage.setItem("cloud-kitchen:settings:v1", "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("progress persistence", () => {
  it("returns empty progress when nothing is stored", () => {
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });
  it("round-trips progress through localStorage", () => {
    const p = { best: { "ck-sunny-side-up": 500000 }, bestGrade: { "ck-sunny-side-up": "A" as Grade }, cleared: ["ck-sunny-side-up"] };
    saveProgress(p);
    expect(loadProgress()).toEqual(p);
  });
});

describe("recordResult", () => {
  it("records best score and grade", () => {
    let p = EMPTY_PROGRESS;
    p = recordResult(p, "lvl-1", 100000, "D");
    expect(p.best["lvl-1"]).toBe(100000);
    expect(p.bestGrade["lvl-1"]).toBe("D");
    expect(p.cleared).toContain("lvl-1");
  });
  it("only keeps the higher score", () => {
    let p = EMPTY_PROGRESS;
    p = recordResult(p, "lvl-1", 100000, "D");
    p = recordResult(p, "lvl-1", 50000, "D");
    expect(p.best["lvl-1"]).toBe(100000);
  });
  it("only keeps the higher grade", () => {
    let p = EMPTY_PROGRESS;
    p = recordResult(p, "lvl-1", 100000, "D");
    p = recordResult(p, "lvl-1", 100000, "A");
    expect(p.bestGrade["lvl-1"]).toBe("A");
  });
  it("does not duplicate cleared level ids", () => {
    let p = EMPTY_PROGRESS;
    p = recordResult(p, "lvl-1", 100000, "D");
    p = recordResult(p, "lvl-1", 200000, "D");
    expect(p.cleared.filter((id) => id === "lvl-1").length).toBe(1);
  });
});
