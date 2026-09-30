import { CHALLENGE_STAGES, STAGES } from "../game/stages";
import type { ProgressApi } from "../hooks/useProgress";

export function TitleScreen({
  progress,
  isUnlocked,
  onSelectStage,
  onShowInstructions,
  onShowSettings,
  onSandbox,
  onTutorial,
  practiceMode,
  onTogglePractice,
}: {
  progress: ProgressApi["progress"];
  isUnlocked: (id: string) => boolean;
  onSelectStage: (id: string, practice: boolean) => void;
  onShowInstructions: () => void;
  onShowSettings: () => void;
  onSandbox: () => void;
  onTutorial: () => void;
  practiceMode: boolean;
  onTogglePractice: (next: boolean) => void;
}) {
  return (
    <section className="screen" aria-labelledby="title-heading">
      <h1 className="screen__title" id="title-heading">
        Orbit Orchestra
      </h1>
      <p className="screen__subtitle">
        Conduct a miniature solar system. Each planet crosses the beat line on
        its own rhythm. Strike the matching key at the crossing to trigger its
        instrument.
      </p>

      <div className="stage-grid" role="list">
        {CHALLENGE_STAGES.map((s, idx) => {
          const unlocked = isUnlocked(s.id);
          const best = progress.best[s.id] ?? 0;
          return (
            <button
              key={s.id}
              className="stage-card"
              role="listitem"
              disabled={!unlocked}
              onClick={() => onSelectStage(s.id, practiceMode)}
              aria-label={`${unlocked ? "Play" : "Locked"} stage ${idx + 1}: ${s.name}`}
            >
              <span className="stage-card__name">
                {idx + 1}. {s.name}
              </span>
              <span className="stage-card__meta">
                {s.planets.length} planets &middot; {s.difficulty}
              </span>
              {best > 0 ? (
                <span className="stage-card__best">Best: {best.toLocaleString()}</span>
              ) : null}
              {!unlocked ? (
                <span className="stage-card__lock">
                  Clear stage {idx} to unlock
                </span>
              ) : null}
            </button>
          );
        })}
        {(() => {
          const sb = STAGES.find((s) => s.difficulty === "sandbox");
          if (!sb) return null;
          return (
            <button
              className="stage-card"
              role="listitem"
              onClick={onSandbox}
              aria-label="Open sandbox: free play with adjustable orbits"
            >
              <span className="stage-card__name">{sb.name}</span>
              <span className="stage-card__meta">
                Free play &middot; adjust speed and instruments
              </span>
            </button>
          );
        })()}
      </div>

      <div className="btn-row">
        <button className="btn btn--primary" onClick={onTutorial}>
          Tutorial
        </button>
        <button className="btn" onClick={onShowInstructions}>
          How to play
        </button>
        <button className="btn btn--ghost" onClick={onShowSettings}>
          Settings
        </button>
      </div>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-panel)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          className="toggle"
          checked={practiceMode}
          onChange={(e) => onTogglePractice(e.target.checked)}
          aria-label="Practice mode: auto-sound and no fail for the next stage"
        />
        <span style={{ fontWeight: 600 }}>
          Practice mode
        </span>
        <span className="settings__hint">
          (auto-sound teaches the rhythm, no fail)
        </span>
      </label>

      <p className="empty-state" style={{ fontSize: "0.8rem" }}>
        Original artwork and synthesized sound. No third-party assets.
      </p>
    </section>
  );
}
