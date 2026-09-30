import { useCallback, useEffect, useMemo, useState } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import {
  BUILT_IN_LEVELS,
  decodeLevel,
  normalizeLevel,
  validateLevel,
  type ValidationResult,
} from "./game/levels";
import type { GamePhase, Level, LevelProgress, ScoreResult, Settings } from "./game/types";
import {
  loadProgress,
  loadSettings,
  recordResult,
  saveProgress,
  saveSettings,
} from "./state/storage";
import { TitleScreen } from "./components/TitleScreen";
import { Instructions } from "./components/Instructions";
import { LevelSelect } from "./components/LevelSelect";
import { GameScreen } from "./components/GameScreen";
import { ResultScreen } from "./components/ResultScreen";
import { LevelBuilder } from "./components/LevelBuilder";
import { SettingsPanel } from "./components/SettingsPanel";

export interface CustomLevelEntry {
  level: Level;
  code: string;
}

export function App() {
  const [phase, setPhase] = useState<GamePhase>("title");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [progress, setProgress] = useState<LevelProgress>(() => loadProgress());
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [lastResult, setLastResult] = useState<ScoreResult | null>(null);
  const [customLevels, setCustomLevels] = useState<CustomLevelEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Single shared AudioEngine for the session, created lazily.
  const audioEngine = useMemo(() => new AudioEngine(), []);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveProgress(progress); }, [progress]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Detect prefers-reduced-motion on first mount and follow the OS setting.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches && !settings.reducedMotion) {
      setSettings((s) => ({ ...s, reducedMotion: true }));
    }
    const handler = (e: MediaQueryListEvent) => {
      setSettings((s) => ({ ...s, reducedMotion: e.matches }));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  const startLevel = useCallback((level: Level) => {
    setCurrentLevel(level);
    setLastResult(null);
    setPhase("playing");
  }, []);

  const handleComplete = useCallback(
    (result: ScoreResult) => {
      if (!currentLevel) return;
      setLastResult(result);
      setProgress((p) => recordResult(p, currentLevel.id, result.score, result.grade));
      setPhase("result");
    },
    [currentLevel]
  );

  const handleQuit = useCallback(() => {
    void audioEngine.stop();
    setPhase("level-select");
  }, [audioEngine]);

  const handleRestart = useCallback(() => {
    if (currentLevel) startLevel(currentLevel);
  }, [currentLevel, startLevel]);

  const importLevelFromCode = useCallback((code: string): ValidationResult => {
    try {
      const parsed = decodeLevel(code);
      const v = validateLevel(parsed);
      if (!v.ok) return v;
      const level = normalizeLevel(parsed as Level);
      const entry: CustomLevelEntry = { level, code };
      setCustomLevels((prev) => {
        const without = prev.filter((e) => e.level.id !== level.id);
        return [entry, ...without].slice(0, 20);
      });
      return { ok: true, errors: [], warnings: v.warnings };
    } catch (e) {
      return { ok: false, errors: [`Could not parse level code: ${(e as Error).message}`], warnings: [] };
    }
  }, []);

  const allLevels = useMemo<Level[]>(
    () => [...BUILT_IN_LEVELS, ...customLevels.map((c) => c.level)],
    [customLevels]
  );

  return (
    <Shell>
      {phase === "title" && (
        <TitleScreen
          onPlay={() => setPhase("level-select")}
          onInstructions={() => setPhase("instructions")}
          onBuilder={() => setPhase("builder")}
          onSettings={() => setPhase("settings")}
          hasProgress={progress.cleared.length > 0}
          bestTotal={Object.values(progress.best).reduce((a, b) => a + b, 0)}
        />
      )}
      {phase === "instructions" && (
        <Instructions onBack={() => setPhase("title")} onPlay={() => setPhase("level-select")} />
      )}
      {phase === "level-select" && (
        <LevelSelect
          levels={allLevels}
          progress={progress}
          onPick={startLevel}
          onBack={() => setPhase("title")}
          onBuilder={() => setPhase("builder")}
          onImport={importLevelFromCode}
          onSettings={() => setPhase("settings")}
        />
      )}
      {phase === "playing" && currentLevel && (
        <GameScreen
          level={currentLevel}
          settings={settings}
          audioEngine={audioEngine}
          onComplete={handleComplete}
          onQuit={handleQuit}
          onSettingsChange={setSettings}
          showToast={showToast}
        />
      )}
      {phase === "result" && currentLevel && lastResult && (
        <ResultScreen
          result={lastResult}
          level={currentLevel}
          best={progress.best[currentLevel.id] ?? 0}
          bestGrade={progress.bestGrade[currentLevel.id]}
          onRetry={handleRestart}
          onMenu={() => setPhase("level-select")}
          onBuilder={() => setPhase("builder")}
        />
      )}
      {phase === "builder" && (
        <LevelBuilder
          onPlay={startLevel}
          onBack={() => setPhase("title")}
          onImport={importLevelFromCode}
          showToast={showToast}
        />
      )}
      {phase === "settings" && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onBack={() => setPhase("title")}
          audioEngine={audioEngine}
        />
      )}
      <Toast msg={toast} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">Cloud <span className="accent">Kitchen</span></h1>
          <p className="app-subtitle">Compose surreal breakfast in rhythmic patterns.</p>
        </div>
      </header>
      {children}
    </div>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}
