interface InstructionsProps {
  onBack: () => void;
  onPlay: () => void;
}

const LANE_KEYS = ["D", "F", "J", "K"];

export function Instructions({ onBack, onPlay }: InstructionsProps) {
  return (
    <section className="panel" aria-labelledby="how-heading">
      <h2 id="how-heading" style={{ marginTop: 0 }}>How to play</h2>

      <h3 style={{ color: "var(--cyan)" }}>The idea</h3>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        Ingredient arcs fall from the top of the screen toward a plate at the bottom. When an
        ingredient lands on the plate, press its lane key. The closer to the center of the beat,
        the higher your judgement: <strong style={{ color: "var(--acid)" }}>Perfect</strong>,{" "}
        <strong style={{ color: "var(--cyan)" }}>Great</strong>,{" "}
        <strong style={{ color: "var(--teal)" }}>Good</strong>, or{" "}
        <strong style={{ color: "var(--scam)" }}>Miss</strong>.
      </p>

      <h3 style={{ color: "var(--cyan)" }}>Three pattern types</h3>
      <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
        <li><strong style={{ color: "var(--text)" }}>Tap</strong>: press the lane key once when the ingredient lands.</li>
        <li><strong style={{ color: "var(--text)" }}>Hold</strong>: press when it lands and hold until the tail ends. A chevron marks hold beats.</li>
        <li><strong style={{ color: "var(--text)" }}>Two-step</strong>: press twice in quick succession. A "2x" badge marks these beats.</li>
      </ul>

      <h3 style={{ color: "var(--cyan)" }}>Controls</h3>
      <p className="muted">
        Lane keys (left to right):{" "}
        {LANE_KEYS.map((k, i) => (
          <span key={k}><span className="kbd">{k}</span>{i < LANE_KEYS.length - 1 ? " " : ""}</span>
        ))}
        . On touch devices, tap the lane directly. Press{" "}
        <span className="kbd">Esc</span> or <span className="kbd">P</span> to pause.
      </p>

      <h3 style={{ color: "var(--cyan)" }}>Calibration</h3>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        If your hits feel early or late, open Settings and adjust the latency offset. The offset
        is subtracted from your input time before judging, so a positive value shifts your hits
        earlier. Use Practice mode in a level to dial it in.
      </p>

      <h3 style={{ color: "var(--cyan)" }}>Modes</h3>
      <ul style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>
        <li><strong style={{ color: "var(--text)" }}>Solo</strong>: play a built-in or custom level and chase a high score.</li>
        <li><strong style={{ color: "var(--text)" }}>Remix</strong>: build your own level in the Level Builder and share it as a code.</li>
        <li><strong style={{ color: "var(--text)" }}>Visual-only</strong>: in Settings, mute audio cues. Beats still judge on input timing.</li>
        <li><strong style={{ color: "var(--text)" }}>Practice</strong>: toggle in-game to play without scoring pressure.</li>
      </ul>

      <div className="btn-row" style={{ marginTop: 22 }}>
        <button className="btn btn--primary" onClick={onPlay}>Play</button>
        <button className="btn btn--ghost" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}
