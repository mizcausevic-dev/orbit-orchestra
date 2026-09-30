import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioEngine } from "../audio/AudioEngine";
import { GameEngine, type JudgementInfo } from "../game/engine";
import type { Level, ScoreResult, Settings } from "../game/types";
import { renderFrame } from "./renderer";

interface GameScreenProps {
  level: Level;
  settings: Settings;
  audioEngine: AudioEngine;
  onComplete: (result: ScoreResult) => void;
  onQuit: () => void;
  onSettingsChange: (s: Settings) => void;
  showToast: (msg: string) => void;
}

const LANE_KEYS = ["d", "f", "j", "k"];
// Also accept number keys 1..4 as lane triggers for accessibility.
const LANE_NUM_KEYS = ["1", "2", "3", "4"];

interface PopupJudgement {
  lane: number;
  judgement: string;
  age: number;
}

export function GameScreen({ level, settings, audioEngine, onComplete, onQuit, onSettingsChange, showToast }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const popupsRef = useRef<PopupJudgement[]>([]);
  const activeLanesRef = useRef<Set<number>>(new Set());
  const completedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [practice, setPractice] = useState(false);
  const [hud, setHud] = useState({ score: 0, combo: 0, songPos: 0 });
  const [activeLanes, setActiveLanes] = useState<Set<number>>(new Set());
  const [audioReady, setAudioReady] = useState(false);

  // Push settings into the audio engine whenever they change.
  useEffect(() => {
    audioEngine.setMuted(settings.muted);
    audioEngine.setVolume(settings.volume);
    audioEngine.setVisualOnly(settings.visualOnly);
  }, [settings, audioEngine]);

  // Start the level on mount.
  const startLevel = useCallback(async () => {
    await audioEngine.unlock();
    audioEngine.setMuted(settings.muted);
    audioEngine.setVolume(settings.volume);
    audioEngine.setVisualOnly(settings.visualOnly);
    setAudioReady(audioEngine.isReady);

    const engine = new GameEngine(
      level,
      settings,
      () => audioEngine.getAudioTime(),
      () => audioEngine.getSongStartAudioTime(),
      {
        onJudgement: (info: JudgementInfo) => {
          popupsRef.current.push({ lane: info.lane, judgement: info.judgement, age: 0 });
          if (popupsRef.current.length > 12) popupsRef.current.shift();
          if (!info.auto && info.judgement !== "miss") {
            audioEngine.playHitPing();
          }
        },
        onLevelComplete: (result: ScoreResult) => {
          if (completedRef.current) return;
          completedRef.current = true;
          window.setTimeout(() => onComplete(result), 600);
        },
      }
    );
    engineRef.current = engine;
    completedRef.current = false;
    audioEngine.start(level);
    showToast("Tap the lanes when ingredients land on the plate.");
  }, [audioEngine, level, settings, onComplete, showToast]);

  useEffect(() => {
    void startLevel();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      audioEngine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The render + update loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastHudUpdate = 0;
    const loop = () => {
      const engine = engineRef.current;
      if (!engine) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (!paused && !completedRef.current) {
        engine.update();
      }
      const snap = engine.snapshot();

      // Age popups.
      for (const p of popupsRef.current) p.age += 0.016;
      popupsRef.current = popupsRef.current.filter((p) => p.age < 1);

      // Resize canvas to its display size (HiDPI aware).
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.floor(rect.width * dpr);
      const targetH = Math.floor(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderFrame({
        ctx,
        width: rect.width,
        height: rect.height,
        level,
        snapshot: snap,
        settings,
        recentJudgements: popupsRef.current,
        activeLanes: activeLanesRef.current,
      });

      // Throttle HUD state updates to ~10fps to avoid React churn.
      const now = performance.now();
      if (now - lastHudUpdate > 100) {
        lastHudUpdate = now;
        setHud({ score: snap.score, combo: snap.combo, songPos: snap.songPosition });
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [level, settings, paused]);

  // Input handling.
  const laneFromKey = useCallback((key: string): number => {
    const lower = key.toLowerCase();
    const idx = LANE_KEYS.indexOf(lower);
    if (idx >= 0 && idx < level.lanes) return idx;
    const nidx = LANE_NUM_KEYS.indexOf(key);
    if (nidx >= 0 && nidx < level.lanes) return nidx;
    return -1;
  }, [level.lanes]);

  const pressLane = useCallback((lane: number) => {
    const engine = engineRef.current;
    if (!engine || completedRef.current) return;
    if (!audioEngine.isReady) {
      void audioEngine.unlock().then(() => setAudioReady(true));
    }
    engine.onPress(lane);
    activeLanesRef.current = new Set([...activeLanesRef.current, lane]);
    setActiveLanes(new Set(activeLanesRef.current));
  }, [audioEngine]);

  const releaseLane = useCallback((lane: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.onRelease(lane);
    const next = new Set(activeLanesRef.current);
    next.delete(lane);
    activeLanesRef.current = next;
    setActiveLanes(new Set(next));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePause();
        return;
      }
      const lane = laneFromKey(e.key);
      if (lane >= 0) {
        e.preventDefault();
        pressLane(lane);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = laneFromKey(e.key);
      if (lane >= 0) {
        e.preventDefault();
        releaseLane(lane);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneFromKey, pressLane, releaseLane]);

  // Touch / pointer input on the canvas.
  const pointerLaneFromEvent = (clientX: number): number => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(level.lanes - 1, Math.floor((x / rect.width) * level.lanes)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (paused) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pressLane(pointerLaneFromEvent(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    releaseLane(pointerLaneFromEvent(e.clientX));
  };

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) {
        audioEngine.pause();
      } else {
        audioEngine.resume();
      }
      return next;
    });
  }, [audioEngine]);

  const togglePractice = () => {
    setPractice((p) => !p);
    showToast(!practice ? "Practice mode on. No score pressure." : "Practice mode off.");
  };

  const handleQuit = () => {
    if (engineRef.current) engineRef.current.abort();
    onQuit();
  };

  const songPct = Math.max(0, Math.min(100, (hud.songPos / level.length) * 100));
  const laneKeyLabels = LANE_KEYS.slice(0, level.lanes).map((k) => k.toUpperCase());

  return (
    <section aria-labelledby="game-heading">
      <h2 id="game-heading" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Playing {level.name}
      </h2>

      <div className="hud" style={{ marginBottom: 8 }}>
        <div>
          <div className="hud__score">{hud.score.toLocaleString()}</div>
          <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{level.name} · {level.bpm} BPM</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="hud__combo">{hud.combo > 0 ? `${hud.combo} combo` : ""}</div>
          {practice && <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>PRACTICE</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="hud__timer">{hud.songPos.toFixed(1)}s / {level.length}s</div>
          <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <button className="btn btn--ghost" onClick={togglePractice} aria-pressed={practice}>Practice</button>
            <button className="btn btn--ghost" onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            <button className="btn btn--danger" onClick={handleQuit}>Quit</button>
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="game-wrap"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="Gameplay area. Tap or press lane keys to hit ingredients."
      >
        <canvas ref={canvasRef} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${songPct}%`, background: "var(--cyan)" }} />
        </div>

        {!audioReady && !settings.visualOnly && (
          <div className="overlay">
            <div className="overlay__card">
              <p className="muted">Tap a lane or press a key to enable audio.</p>
            </div>
          </div>
        )}

        {paused && (
          <div className="overlay">
            <div className="overlay__card">
              <h3 style={{ marginTop: 0 }}>Paused</h3>
              <div className="btn-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <button className="btn btn--primary" onClick={togglePause} autoFocus>Resume</button>
                <button className="btn" onClick={() => { onSettingsChange(settings); showToast("Adjust latency in Settings."); }}>Settings</button>
                <button className="btn btn--danger" onClick={handleQuit}>Quit</button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
                Latency offset: {(settings.latencyOffset * 1000).toFixed(0)} ms
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="lane-keys" aria-hidden="true">
        {laneKeyLabels.map((k, i) => (
          <div key={i} className={`lane-key${activeLanes.has(i) ? " is-active" : ""}`}>{k}</div>
        ))}
      </div>

      <p className="muted center" style={{ fontSize: 12, marginTop: 8 }}>
        Keys: {laneKeyLabels.join(" ")} · Pause: Esc · Practice toggles score pressure
      </p>
    </section>
  );
}
