export function PauseOverlay({
  onResume,
  onRestart,
  onQuit,
  showRestart = true,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  showRestart?: boolean;
}) {
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <h2 className="overlay__title" id="pause-title">
        Paused
      </h2>
      <p className="screen__subtitle">
        Timing is frozen. Resume picks up exactly where you left off.
      </p>
      <div className="btn-row">
        <button className="btn btn--primary" onClick={onResume} autoFocus>
          Resume
        </button>
        {showRestart && (
          <button className="btn" onClick={onRestart}>
            Restart
          </button>
        )}
        <button className="btn btn--ghost" onClick={onQuit}>
          Quit to title
        </button>
      </div>
    </div>
  );
}
