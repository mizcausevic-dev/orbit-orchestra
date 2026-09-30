import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  HitResult,
  Judgement,
  ScheduledEvent,
  Settings,
  StageConfig,
  StageResult,
} from "../game/types";
import { GameEngine } from "../game/engine";
import { GameClock } from "../utils/timing";
import { BEAT_LINE_ANGLE, planetAngle } from "../game/planets";
import type { AudioEngine } from "../audio/AudioEngine";
import { drawScene, type HitFlash } from "./renderer";
import { HUD, type JudgePopup } from "./HUD";
import { PauseOverlay } from "./PauseOverlay";
import { SandboxControls, type SandboxPlanetState } from "./SandboxControls";

interface Props {
  stage: StageConfig;
  settings: Settings;
  audio: AudioEngine;
  practice: boolean;
  onResult: (result: StageResult) => void;
  onQuit: () => void;
  onOpenSettings: () => void;
}

const HUD_THROTTLE_MS = 80;
const POPUP_TTL_MS = 600;
const LOOKAHEAD_SEC = 0.4;

export function GameScreen({
  stage,
  settings,
  audio,
  practice,
  onResult,
  onQuit,
  onOpenSettings,
}: Props) {
  const isSandbox = stage.difficulty === "sandbox";
  const autoSound = isSandbox || practice;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const clockRef = useRef<GameClock | null>(null);
  const rafRef = useRef<number | null>(null);
  const flashesRef = useRef<HitFlash[]>([]);
  const popupIdRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const finishedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({ score: 0, combo: 0, maxCombo: 0, timer: 0 });
  const [popups, setPopups] = useState<JudgePopup[]>([]);
  const [sandboxState, setSandboxState] = useState<SandboxPlanetState[]>(() =>
    stage.planets.map((p) => ({ period: p.period, instrument: p.instrument })),
  );

  // The effective stage used by both the engine and the renderer. In
  // sandbox, planet periods and instruments come from the live sandboxState
  // so the player can adjust orbits at runtime and see and hear the change
  // immediately. We rebuild the engine whenever sandboxState changes.
  const effectiveStage: StageConfig = useMemo(() => {
    if (!isSandbox) return stage;
    return {
      ...stage,
      planets: stage.planets.map((p, i) => ({
        ...p,
        period: sandboxState[i]?.period ?? p.period,
        instrument: sandboxState[i]?.instrument ?? p.instrument,
      })),
    };
  }, [stage, isSandbox, sandboxState]);

  // stageRef tracks effectiveStage so the rAF loop and renderer always read
  // the current (sandbox-adjusted) planet periods without going through
  // React state.
  const stageRef = useRef(effectiveStage);
  stageRef.current = effectiveStage;

  const pushPopup = useCallback((judgement: Judgement) => {
    const id = popupIdRef.current++;
    setPopups((prev) => [...prev.slice(-3), { id, judgement }]);
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, POPUP_TTL_MS);
  }, []);

  const pushFlash = useCallback((planetId: number, judgement: HitFlash["judgement"]) => {
    const gt = clockRef.current?.now() ?? 0;
    flashesRef.current.push({ planetId, startedAt: gt, judgement });
    if (flashesRef.current.length > 24) flashesRef.current.shift();
  }, []);

  const handleJudgement = useCallback(
    (hit: HitResult) => {
      pushPopup(hit.judgement);
      if (hit.judgement !== "miss") {
        pushFlash(hit.planetId, hit.judgement as HitFlash["judgement"]);
        // In challenge (non-autoSound) modes, the hit triggers the sound.
        if (!autoSound) {
          const planet = stageRef.current.planets.find((p) => p.id === hit.planetId);
          if (planet) audio.playInstrument(planet.instrument, audio.currentTime);
        }
      } else {
        pushFlash(hit.planetId, "miss");
      }
    },
    [autoSound, audio, pushFlash, pushPopup],
  );

  const handleAutoMiss = useCallback(
    (_e: ScheduledEvent) => {
      pushPopup("miss");
    },
    [pushPopup],
  );

  const handleEventActive = useCallback(
    (e: ScheduledEvent) => {
      if (!autoSound) return;
      const clock = clockRef.current;
      if (!clock) return;
      const planet = stageRef.current.planets.find((p) => p.id === e.planetId);
      if (!planet) return;
      const audioTime = clock.gameTimeToAudioTime(e.time);
      audio.playInstrument(planet.instrument, audioTime);
    },
    [autoSound, audio],
  );

  // (Re)create the engine and clock when the effective stage changes, or on
  // first mount. The clock is created once per stage run; sandbox orbit
  // changes rebuild the engine but keep the clock so timing stays continuous.
  const buildEngine = useCallback(() => {
    const clock = clockRef.current ?? new GameClock(() => audio.currentTime);
    clockRef.current = clock;
    const engine = new GameEngine(
      effectiveStage,
      {
        getGameTime: () => clock.now(),
        onJudgement: handleJudgement,
        onAutoMiss: handleAutoMiss,
        onEventActive: handleEventActive,
      },
      settingsRef.current.latencyOffsetMs,
    );
    engineRef.current = engine;
    finishedRef.current = false;
  }, [effectiveStage, audio, handleJudgement, handleAutoMiss, handleEventActive]);

  useEffect(() => {
    buildEngine();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [buildEngine]);

  // Main loop.
  const frame = useCallback(() => {
    const engine = engineRef.current;
    const clock = clockRef.current;
    const canvas = canvasRef.current;
    if (!engine || !clock || !canvas) {
      rafRef.current = requestAnimationFrame(frame);
      return;
    }
    engine.update();
    const now = clock.now();

    // Draw.
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const events = engine.getEvents();
      const upcoming = events.filter(
        (e) => e.time >= now - 0.05 && e.time <= now + LOOKAHEAD_SEC,
      );
      // Beat pulse: nearest upcoming event distance.
      let nearest = Infinity;
      for (const e of events) {
        const d = Math.abs(e.time - now);
        if (d < nearest) nearest = d;
      }
      const beatPulse = Math.max(0, 1 - nearest / 0.6);
      const gateOpen = nearest <= stageRef.current.windows.perfect / 1000;
      drawScene({
        ctx,
        width: canvas.width / dpr,
        height: canvas.height / dpr,
        dpr,
        planets: stageRef.current.planets,
        gameTime: now,
        upcoming,
        flashes: flashesRef.current,
        reducedMotion: settingsRef.current.reducedMotion,
        beatPulse,
        gateOpen,
      });
    }

    // Throttled HUD update.
    const lastHud = (frame as unknown as { _lastHud?: number })._lastHud ?? 0;
    if (performance.now() - lastHud > HUD_THROTTLE_MS) {
      (frame as unknown as { _lastHud?: number })._lastHud = performance.now();
      const snap = engine.snapshot();
      const timer = stageRef.current.duration > 0
        ? Math.max(0, stageRef.current.duration - now)
        : now;
      setHud({
        score: snap.score,
        combo: snap.combo,
        maxCombo: snap.maxCombo,
        timer,
      });
    }

    // Finish.
    if (engine.isFinished() && !finishedRef.current) {
      finishedRef.current = true;
      const result = engine.finish();
      // small delay so the last judgement popup is visible
      window.setTimeout(() => onResult(result), 350);
      return;
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [onResult]);

  // Start / stop the loop based on paused state.
  useEffect(() => {
    if (paused) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      clockRef.current?.pause();
    } else {
      clockRef.current?.resume();
      rafRef.current = requestAnimationFrame(frame);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [paused, frame]);

  // Canvas sizing with devicePixelRatio + ResizeObserver.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Keyboard input.
  const pressPlanet = useCallback(
    (planetId: number) => {
      const engine = engineRef.current;
      const clock = clockRef.current;
      if (!engine || !clock || paused || finishedRef.current) return;
      // Capture the audio time at the moment of input (monotonic), then
      // convert to game time so it is comparable to scheduled event times.
      // The engine applies the latency offset internally.
      const inputGameTime = clock.audioTimeToGameTime(audio.currentTime);
      engine.handleInput(planetId, inputGameTime);
    },
    [audio, paused],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "escape" || key === "p") {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      const planet = stageRef.current.planets.find((p) => p.key === key);
      if (planet) {
        e.preventDefault();
        pressPlanet(planet.id);
        return;
      }
      // Accessibility aliases: number keys 1..N and space -> first planet.
      if (key === " ") {
        e.preventDefault();
        const first = stageRef.current.planets[0];
        if (first) pressPlanet(first.id);
        return;
      }
      const n = parseInt(key, 10);
      if (!isNaN(n) && n >= 1 && n <= stageRef.current.planets.length) {
        e.preventDefault();
        pressPlanet(stageRef.current.planets[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressPlanet]);

  const timerLabel = stage.duration > 0 ? "Time" : "Elapsed";

  return (
    <section className="game" aria-label={`${stage.name} gameplay`}>
      <div className="topbar">
        <span className="topbar__brand">{stage.name}{practice ? " (practice)" : ""}</span>
        <div className="topbar__actions">
          <button
            className="btn btn--ghost"
            onClick={() => setPaused(true)}
            aria-label="Pause"
          >
            Pause (Esc)
          </button>
          <button className="btn btn--ghost" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </div>

      <div className="game__canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="game__canvas"
          role="img"
          aria-label="Solar system. Planets orbit a central star and cross a beat line at the top."
        />
        <HUD
          score={hud.score}
          combo={hud.combo}
          timer={hud.timer}
          timerLabel={timerLabel}
          popups={popups}
        />
        {paused && (
          <PauseOverlay
            onResume={() => setPaused(false)}
            onRestart={() => {
              setPaused(false);
              buildEngine();
              flashesRef.current = [];
              setPopups([]);
            }}
            onQuit={onQuit}
          />
        )}
      </div>

      {isSandbox ? (
        <div style={{ padding: "0 12px 12px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <SandboxControls
            planets={stage.planets}
            state={sandboxState}
            onChange={(i, patch) =>
              setSandboxState((prev) =>
                prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
              )
            }
          />
        </div>
      ) : (
        <div className="key-legend" role="group" aria-label="Planet keys">
          {stage.planets.map((p) => (
            <button
              key={p.id}
              className="key-chip"
              onPointerDown={(e) => {
                e.preventDefault();
                pressPlanet(p.id);
              }}
              aria-label={`Trigger planet ${p.label} (key ${p.key.toUpperCase()})`}
            >
              <span className="key-chip__dot" style={{ color: p.color, background: p.color }} />
              <span>{p.label}</span>
              <span className="key-chip__key">{p.key}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// Re-export for tests that want to compute angles without importing the
// planets module directly through the component.
export { BEAT_LINE_ANGLE, planetAngle };
