import { useState } from "react";
import type { AudioEngine } from "../audio/AudioEngine";
import type { Settings } from "../game/types";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  audioEngine: AudioEngine;
}

export function SettingsPanel({ settings, onChange, onBack, audioEngine }: SettingsPanelProps) {
  const [calibrationState, setCalibrationState] = useState<"idle" | "arming" | "listening" | "done">("idle");
  const [calibrationDelta, setCalibrationDelta] = useState<number | null>(null);

  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  // Simple calibration: play a steady beat and let the user tap along. We
  // measure the average signed delta and suggest it as the latency offset.
  const runCalibration = async () => {
    await audioEngine.unlock();
    setCalibrationState("arming");
    setCalibrationDelta(null);
    // Play 4 reference clicks at 0.5s intervals starting in 1s.
    const start = audioEngine.getAudioTime() + 1.0;
    const beats = 4;
    const taps: number[] = [];
    const handler = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      taps.push(audioEngine.getAudioTime());
    };
    window.addEventListener("keydown", handler);
    setCalibrationState("listening");
    for (let i = 0; i < beats; i++) {
      const when = start + i * 0.5;
      // Schedule a click via the engine's ping voice.
      audioEngine.playHitPingAt(when, 660);
    }
    window.setTimeout(() => {
      window.removeEventListener("keydown", handler);
      if (taps.length === 0) {
        setCalibrationState("idle");
        return;
      }
      // Average signed delta vs nearest scheduled beat.
      let sum = 0;
      for (const tap of taps) {
        let nearest = Infinity;
        for (let i = 0; i < beats; i++) {
          const beatT = start + i * 0.5;
          nearest = Math.min(nearest, Math.abs(tap - beatT));
          // Use signed delta to the closest beat.
        }
        void nearest;
        // Find the closest beat's signed delta.
        let bestSigned = 0;
        let bestAbs = Infinity;
        for (let i = 0; i < beats; i++) {
          const beatT = start + i * 0.5;
          const d = tap - beatT;
          if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); bestSigned = d; }
        }
        sum += bestSigned;
      }
      const avg = sum / taps.length;
      setCalibrationDelta(avg);
      setCalibrationState("done");
    }, (beats * 500) + 1500);
  };

  const applyCalibration = () => {
    if (calibrationDelta == null) return;
    // If the user taps late (positive delta), we want to subtract that from
    // future inputs, so set latencyOffset = delta.
    update({ latencyOffset: Math.round(calibrationDelta * 1000) / 1000 });
  };

  return (
    <section className="panel" aria-labelledby="settings-heading">
      <div className="app-header" style={{ marginBottom: 8 }}>
        <h2 id="settings-heading" style={{ margin: 0 }}>Settings</h2>
        <button className="btn btn--ghost" onClick={onBack}>Back</button>
      </div>

      <div className="settings-row">
        <div>
          <label htmlFor="latency">Latency offset</label>
          <div className="hint">{(settings.latencyOffset * 1000).toFixed(0)} ms</div>
        </div>
        <input
          id="latency"
          type="range"
          min={-0.2}
          max={0.2}
          step={0.005}
          value={settings.latencyOffset}
          onChange={(e) => update({ latencyOffset: parseFloat(e.target.value) })}
          aria-describedby="latency-hint"
        />
      </div>
      <p id="latency-hint" className="muted" style={{ fontSize: 12, margin: "-4px 0 16px" }}>
        Negative shifts your hits earlier, positive later. Use calibration to find your value.
      </p>

      <div className="settings-row">
        <div>
          <label htmlFor="volume">Master volume</label>
          <div className="hint">{Math.round(settings.volume * 100)}%</div>
        </div>
        <input
          id="volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.volume}
          onChange={(e) => update({ volume: parseFloat(e.target.value) })}
        />
      </div>

      <div className="settings-row" style={{ marginTop: 12 }}>
        <label htmlFor="muted">Mute audio</label>
        <input
          id="muted"
          type="checkbox"
          checked={settings.muted}
          onChange={(e) => update({ muted: e.target.checked })}
        />
      </div>

      <div className="settings-row">
        <label htmlFor="visual-only">Visual-only mode (no audio cues)</label>
        <input
          id="visual-only"
          type="checkbox"
          checked={settings.visualOnly}
          onChange={(e) => update({ visualOnly: e.target.checked })}
        />
      </div>

      <div className="settings-row">
        <label htmlFor="reduced-motion">Reduced motion</label>
        <input
          id="reduced-motion"
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => update({ reducedMotion: e.target.checked })}
        />
      </div>

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 style={{ color: "var(--cyan)", margin: "0 0 8px" }}>Calibration</h3>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Press the button, then tap <span className="kbd">Space</span> along with the four clicks.
          We will measure your average timing and suggest a latency offset.
        </p>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={runCalibration} disabled={calibrationState === "listening"}>
            {calibrationState === "listening" ? "Listening... tap Space" : "Run calibration"}
          </button>
          {calibrationState === "done" && calibrationDelta != null && (
            <button className="btn btn--primary" onClick={applyCalibration}>
              Apply {(calibrationDelta * 1000).toFixed(0)} ms
            </button>
          )}
        </div>
        {calibrationState === "done" && calibrationDelta != null && (
          <div className="hint" style={{ marginTop: 8 }}>
            Measured average: {(calibrationDelta * 1000).toFixed(0)} ms (positive = you tapped late).
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 22, fontSize: 12 }}>
        Settings are stored only on this device (localStorage). No account, no telemetry.
      </p>
    </section>
  );
}
