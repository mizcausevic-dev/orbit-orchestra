import type { Grade, Level, ScoreResult } from "../game/types";

interface ResultScreenProps {
  result: ScoreResult;
  level: Level;
  best: number;
  bestGrade?: Grade;
  onRetry: () => void;
  onMenu: () => void;
  onBuilder: () => void;
}

export function ResultScreen({ result, level, best, bestGrade, onRetry, onMenu, onBuilder }: ResultScreenProps) {
  const isNewBest = result.score >= best;
  const gradeClass = `result-grade result-grade--${result.grade}`;
  const accPct = (result.accuracy * 100).toFixed(1);

  return (
    <section className="panel center" aria-labelledby="result-heading">
      <h2 id="result-heading" className="muted" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
        {level.name} · {level.difficulty}
      </h2>
      <div className={gradeClass} aria-label={`Grade ${result.grade}`}>{result.grade}</div>

      {result.fullCombo && (
        <div style={{ color: "var(--acid)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
          FULL COMBO
        </div>
      )}

      <div className="result-stats" style={{ justifyContent: "center", maxWidth: 360, margin: "18px auto" }}>
        <dt>Score</dt><dd>{result.score.toLocaleString()}</dd>
        <dt>Accuracy</dt><dd>{accPct}%</dd>
        <dt>Max combo</dt><dd>{result.maxCombo}</dd>
        <dt>Perfect</dt><dd style={{ color: "var(--acid)" }}>{result.judgements.perfect}</dd>
        <dt>Great</dt><dd style={{ color: "var(--cyan)" }}>{result.judgements.great}</dd>
        <dt>Good</dt><dd style={{ color: "var(--teal)" }}>{result.judgements.good}</dd>
        <dt>Miss</dt><dd style={{ color: "var(--scam)" }}>{result.judgements.miss}</dd>
      </div>

      <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 18 }}>
        {isNewBest && best > 0 ? "New personal best!" : `Best on this level: ${best.toLocaleString()}`}
        {bestGrade ? ` (${bestGrade})` : ""}
      </div>

      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button className="btn btn--primary" onClick={onRetry} autoFocus>Play again</button>
        <button className="btn" onClick={onMenu}>Level menu</button>
        <button className="btn btn--ghost" onClick={onBuilder}>Build a remix</button>
      </div>
    </section>
  );
}
