import { useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import { TitleScreen } from "./components/TitleScreen";
import { InstructionsScreen } from "./components/InstructionsScreen";
import { GameScreen } from "./components/GameScreen";
import { ResultScreen } from "./components/ResultScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { CalibrationOverlay } from "./components/CalibrationOverlay";
import { TutorialOverlay, TUTORIAL_STEPS } from "./components/TutorialOverlay";
import { useSettings } from "./hooks/useSettings";
import { useProgress } from "./hooks/useProgress";
import { CHALLENGE_STAGES, getStageById } from "./game/stages";
import type { GamePhase, StageConfig, StageResult } from "./game/types";
import { initAnalytics, trackScreen } from "./utils/analytics";

export default function App() {
  const { settings, update, reset } = useSettings();
  const progressApi = useProgress();
  const audioRef = useRef<AudioEngine | null>(null);
  if (audioRef.current === null) {
    audioRef.current = new AudioEngine();
  }
  const audio = audioRef.current;

  const [phase, setPhase] = useState<GamePhase>("title");
  const [showSettings, setShowSettings] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [practice, setPractice] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [lastResult, setLastResult] = useState<StageResult | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);

  // Mirror settings into the audio engine whenever they change.
  useEffect(() => {
    audio.setMuted(settings.muted);
    audio.setVisualOnly(settings.visualOnly);
    audio.setVolume(settings.volume);
  }, [audio, settings.muted, settings.visualOnly, settings.volume]);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackScreen(phase);
  }, [phase]);

  // Unlock audio on the first user gesture anywhere in the app.
  useEffect(() => {
    const unlock = async () => {
      if (audioReady) return;
      try {
        await audio.unlock();
        setAudioReady(true);
      } catch {
        setError("Audio could not be unlocked. The game is still playable in visual-only mode.");
      }
    };
    const opts = { once: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audio, audioReady]);

  const activeStage: StageConfig | null = useMemo(() => {
    if (!activeStageId) return null;
    return getStageById(activeStageId) ?? null;
  }, [activeStageId]);

  const startStage = (id: string, isPractice: boolean) => {
    setError(null);
    setActiveStageId(id);
    setPractice(isPractice);
    setLastResult(null);
    setPhase("playing");
  };

  const handleResult = (result: StageResult) => {
    setLastResult(result);
    progressApi.recordResult(result);
    setPhase("result");
  };

  const startTutorial = () => {
    setError(null);
    setTutorialStep(0);
    setActiveStageId("stage-1-waltz");
    setPractice(true);
    setPhase("tutorial");
  };

  const hasNext = (() => {
    if (!activeStage) return false;
    const idx = CHALLENGE_STAGES.findIndex((s) => s.id === activeStage.id);
    return idx >= 0 && idx + 1 < CHALLENGE_STAGES.length;
  })();

  const nextStageId = (() => {
    if (!activeStage) return null;
    const idx = CHALLENGE_STAGES.findIndex((s) => s.id === activeStage.id);
    if (idx < 0 || idx + 1 >= CHALLENGE_STAGES.length) return null;
    return CHALLENGE_STAGES[idx + 1].id;
  })();

  return (
    <div className="app">
      <main className="app__main">
        {error && (
          <div className="error-state" role="alert" style={{ margin: "12px" }}>
            {error}
          </div>
        )}

        {phase === "title" && (
          <TitleScreen
            progress={progressApi.progress}
            isUnlocked={progressApi.isUnlocked}
            onSelectStage={(id, practice) => startStage(id, practice)}
            onShowInstructions={() => setPhase("instructions")}
            onShowSettings={() => setShowSettings(true)}
            onSandbox={() => startStage("sandbox", false)}
            onTutorial={startTutorial}
            practiceMode={practiceMode}
            onTogglePractice={setPracticeMode}
          />
        )}

        {phase === "instructions" && (
          <InstructionsScreen onBack={() => setPhase("title")} />
        )}

        {phase === "tutorial" && activeStage && (
          <>
            <GameScreen
              stage={activeStage}
              settings={settings}
              audio={audio}
              practice={practice}
              onResult={handleResult}
              onQuit={() => {
                progressApi.markTutorialDone();
                setPhase("title");
              }}
              onOpenSettings={() => setShowSettings(true)}
            />
            <TutorialOverlay
              step={tutorialStep}
              total={TUTORIAL_STEPS.length}
              onNext={() => {
                if (tutorialStep + 1 < TUTORIAL_STEPS.length) {
                  setTutorialStep((s) => s + 1);
                } else {
                  progressApi.markTutorialDone();
                  setPhase("title");
                }
              }}
              onSkip={() => {
                progressApi.markTutorialDone();
                setPhase("title");
              }}
            />
          </>
        )}

        {phase === "playing" && activeStage && (
          <GameScreen
            stage={activeStage}
            settings={settings}
            audio={audio}
            practice={practice}
            onResult={handleResult}
            onQuit={() => setPhase("title")}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {phase === "result" && lastResult && activeStage && (
          <ResultScreen
            result={lastResult}
            stageName={activeStage.name}
            hasNext={hasNext}
            onRetry={() => startStage(activeStage.id, practice)}
            onNext={() => nextStageId && startStage(nextStageId, false)}
            onTitle={() => setPhase("title")}
            onSandbox={() => startStage("sandbox", false)}
          />
        )}
      </main>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={update}
          onClose={() => setShowSettings(false)}
          onReset={reset}
          onCalibrate={() => {
            setShowSettings(false);
            setShowCalibration(true);
          }}
        />
      )}

      {showCalibration && (
        <CalibrationOverlay
          audio={audio}
          onApply={(offset) => {
            update({ latencyOffsetMs: offset });
            setShowCalibration(false);
          }}
          onClose={() => setShowCalibration(false)}
        />
      )}
    </div>
  );
}
