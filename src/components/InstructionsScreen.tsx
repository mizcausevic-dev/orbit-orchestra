export function InstructionsScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="screen" aria-labelledby="instructions-heading">
      <h2 className="screen__title" id="instructions-heading" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
        How to play
      </h2>
      <div className="panel">
        <ol style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: "10px" }}>
          <li>
            <strong>Watch the orbits.</strong> Planets revolve around the central
            star. Each has its own period, so crossings happen on a polyrhythm.
          </li>
          <li>
            <strong>Find the beat line.</strong> The glowing radius at the top of
            the system is the gate. A planet triggers its instrument the instant
            it crosses that line.
          </li>
          <li>
            <strong>Strike the matching key.</strong> Each planet is mapped to a
            key shown in the legend below the system (A, S, D, F, G). Press when
            its planet reaches the gate.
          </li>
          <li>
            <strong>Timing is scored.</strong> Perfect, Great, Good, and Miss
            windows shrink as difficulty rises. A clean streak builds a combo
            multiplier up to 2x.
          </li>
          <li>
            <strong>Pause anytime.</strong> Press Escape or P to pause. Timing
            freezes with the game so resume never costs you a beat.
          </li>
          <li>
            <strong>Calibrate if you are early or late.</strong> Open Settings and
            adjust the latency offset. Positive values push your hit window later
            (useful if your speakers or input lag behind).
          </li>
          <li>
            <strong>Play silently if you need to.</strong> Visual-only mode and
            mute are both available. The game is fully playable without sound.
          </li>
        </ol>
      </div>
      <div className="btn-row">
        <button className="btn btn--primary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
