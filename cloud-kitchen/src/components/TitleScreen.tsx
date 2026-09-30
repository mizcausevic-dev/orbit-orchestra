interface TitleScreenProps {
  onPlay: () => void;
  onInstructions: () => void;
  onBuilder: () => void;
  onSettings: () => void;
  hasProgress: boolean;
  bestTotal: number;
}

export function TitleScreen({ onPlay, onInstructions, onBuilder, onSettings, hasProgress, bestTotal }: TitleScreenProps) {
  return (
    <section className="panel" aria-labelledby="title-heading">
      <h2 id="title-heading" style={{ fontSize: "clamp(28px, 6vw, 44px)", margin: "0 0 8px", color: "var(--text)" }}>
        Plate the order. Hit the beat.
      </h2>
      <p className="muted" style={{ maxWidth: 560, lineHeight: 1.6 }}>
        Cloud Kitchen is an original browser rhythm game. Animated ingredient arcs fall toward
        the plate. Tap, hold, and chain two-step patterns to compose surreal breakfast orders in
        time with procedurally synthesized music. Three built-in levels, a level builder, and a
        calibration tool. Everything runs locally in your browser.
      </p>

      <div className="btn-row" style={{ marginTop: 22 }}>
        <button className="btn btn--primary" onClick={onPlay} autoFocus>
          {hasProgress ? "Continue" : "Start playing"}
        </button>
        <button className="btn" onClick={onInstructions}>How to play</button>
        <button className="btn" onClick={onBuilder}>Level builder</button>
        <button className="btn btn--ghost" onClick={onSettings}>Settings</button>
      </div>

      {hasProgress && (
        <p className="muted" style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Levels cleared: you have progress saved on this device. Best score total: {bestTotal.toLocaleString()}.
        </p>
      )}

      <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
        Original work. No third-party logos, audio, or artwork. Music is synthesized at runtime.
      </p>
    </section>
  );
}
