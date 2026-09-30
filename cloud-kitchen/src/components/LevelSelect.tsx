import { useState } from "react";
import type { Level, LevelProgress } from "../game/types";
import type { ValidationResult } from "../game/levels";

interface LevelSelectProps {
  levels: Level[];
  progress: LevelProgress;
  onPick: (level: Level) => void;
  onBack: () => void;
  onBuilder: () => void;
  onImport: (code: string) => ValidationResult;
  onSettings: () => void;
}

export function LevelSelect({ levels, progress, onPick, onBack, onBuilder, onImport, onSettings }: LevelSelectProps) {
  const [importCode, setImportCode] = useState("");
  const [importResult, setImportResult] = useState<ValidationResult | null>(null);

  const handleImport = () => {
    if (!importCode.trim()) return;
    const r = onImport(importCode.trim());
    setImportResult(r);
    if (r.ok) setImportCode("");
  };

  return (
    <section className="panel" aria-labelledby="select-heading">
      <div className="app-header" style={{ marginBottom: 8 }}>
        <h2 id="select-heading" style={{ margin: 0 }}>Choose a level</h2>
        <div className="btn-row">
          <button className="btn btn--ghost" onClick={onSettings}>Settings</button>
          <button className="btn" onClick={onBuilder}>Builder</button>
          <button className="btn btn--ghost" onClick={onBack}>Back</button>
        </div>
      </div>

      {levels.length === 0 ? (
        <p className="empty-state">No levels available. Build or import one.</p>
      ) : (
        <div className="grid grid--levels">
          {levels.map((level) => {
            const best = progress.best[level.id];
            const grade = progress.bestGrade[level.id];
            const tagClass =
              level.difficulty === "Easy" ? "tag--easy"
              : level.difficulty === "Medium" ? "tag--medium"
              : level.difficulty === "Hard" ? "tag--hard"
              : "tag--custom";
            return (
              <button
                key={level.id}
                className="panel level-card"
                onClick={() => onPick(level)}
                aria-label={`Play ${level.name}, ${level.difficulty}`}
              >
                <div className="level-card__name">{level.name}</div>
                <div>
                  <span className={`tag ${tagClass}`}>{level.difficulty}</span>{" "}
                  <span className="level-card__meta">{level.bpm} BPM · {level.lanes} lanes · {level.beats.length} beats</span>
                </div>
                {best != null && (
                  <div className="level-card__best">
                    Best: {best.toLocaleString()} {grade ? `· ${grade}` : ""}
                  </div>
                )}
                {level.author && <div className="muted" style={{ fontSize: 11 }}>by {level.author}</div>}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 style={{ color: "var(--cyan)", margin: "0 0 8px" }}>Import a shared level</h3>
        <div className="field">
          <label htmlFor="import-code">Paste a level share code</label>
          <textarea
            id="import-code"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            placeholder="Paste a Cloud Kitchen level code here..."
          />
          <div className="btn-row">
            <button className="btn" onClick={handleImport} disabled={!importCode.trim()}>Import &amp; add to list</button>
          </div>
          {importResult && !importResult.ok && (
            <div className="error" role="alert">
              {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {importResult && importResult.ok && (
            <div className="warn">Imported. Pick the level above to play.</div>
          )}
        </div>
      </div>
    </section>
  );
}
