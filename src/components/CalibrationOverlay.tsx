import { useEffect, useRef, useState } from "react";
import type { AudioEngine } from "../audio/AudioEngine";

const TICK_COUNT = 8;
const TICK_INTERVAL = 0.6; // seconds
const LEAD_IN = 1.0; // seconds before first tick
const WINDOW = 0.3; // ±seconds to accept a tap near a tick

export function CalibrationOverlay({
  audio,
  onApply,
  onClose,
}: {
  audio: AudioEngine;
  onApply: (offsetMs: number) => void;
  onClose: () => void;
}) {
  const tickTimesRef = useRef<number[]>([]);
  const deltasRef = useRef<number[]>([]);
  const [phase, setPhase] = useState<"running" | "done">("running");
  const [taps, setTaps] = useState(0);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    // Schedule the metronome ticks and remember their absolute audio times.
    const start = audio.currentTime + LEAD_IN;
    tickTimesRef.current = Array.from({ length: TICK_COUNT }, (_, i) => start + i * TICK_INTERVAL);
    tickTimesRef.current.forEach((t) => audio.playMetronome(t));
    const totalDur = LEAD_IN + TICK_COUNT * TICK_INTERVAL + 0.2;
    const done = window.setTimeout(() => setPhase("done"), totalDur * 1000);
    return () => window.clearTimeout(done);
  }, [audio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (phase !== "running") return;
      const now = audio.currentTime;
      // nearest tick
      let best = Infinity;
      for (const t of tickTimesRef.current) {
        const d = now - t;
        if (Math.abs(d) < Math.abs(best)) best = d;
      }
      if (Math.abs(best) <= WINDOW) {
        deltasRef.current.push(best);
        setTaps(deltasRef.current.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audio, phase]);

  const compute = () => {
    const ds = deltasRef.current;
    if (ds.length === 0) {
      setResult(0);
      return;
    }
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
    setResult(Math.round(mean * 1000));
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="cal-title">
      <h2 className="overlay__title" id="cal-title">
        Calibration
      </h2>
      <p className="screen__subtitle">
        {phase === "running"
          ? `Tap Space or Enter on each of the ${TICK_COUNT} beats. Taps captured: ${taps}.`
          : "Calibration complete."}
      </p>
      {result === null ? (
        <div className="btn-row">
          {phase === "done" && (
            <button className="btn" onClick={compute}>
              Compute offset
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, textAlign: "center" }}>
          <p>
            Measured offset: <strong>{result} ms</strong>. Positive means you
            tap late; this will be added to your latency offset so future hits
            line up.
          </p>
          <div className="btn-row">
            <button
              className="btn btn--primary"
              onClick={() => onApply(result)}
            >
              Apply
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
