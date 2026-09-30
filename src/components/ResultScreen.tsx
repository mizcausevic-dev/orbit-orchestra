import type { StageResult } from "../game/types";

export function ResultScreen({
  result,
  stageName,
  hasNext,
  onRetry,
  onNext,
  onTitle,
  onSandbox,
}: {
  result: StageResult;
  stageName: string;
  hasNext: boolean;
  onRetry: () => void;
  onNext: () => void;
  onTitle: () => void;
  onSandbox: () => void;
}) {
  const grade = gradeFor(result);
  return (
    <section className="screen" aria-labelledby="result-heading">
      <h2 className="screen__title" id="result-heading" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
        {stageName}
      </h2>
      <div className="result__grade" style={{ color: gradeColor(grade) }}>
        {grade}
      </div>
      <div className="result__score" aria-label={`Final score ${result.score}`}>
        {result.score.toLocaleString()}
      </div>
      {result.cleared ? (
        <p className="screen__subtitle" style={{ color: "var(--color-cash)" }}>
          Stage cleared.
        </p>
      ) : (
        <p className="screen__subtitle" style={{ color: "var(--color-warn)" }}>
          Below target. Try again to unlock the next stage.
        </p>
      )}
      <div className="result__stats" role="table" aria-label="Result breakdown">
        <div className="result__stat" role="row">
          <span>Perfect</span>
          <span style={{ color: "var(--color-acid)" }}>{result.counts.perfect}</span>
        </div>
        <div className="result__stat" role="row">
          <span>Great</span>
          <span style={{ color: "var(--color-cyan)" }}>{result.counts.great}</span>
        </div>
        <div className="result__stat" role="row">
          <span>Good</span>
          <span style={{ color: "var(--color-warn)" }}>{result.counts.good}</span>
        </div>
        <div className="result__stat" role="row">
          <span>Miss</span>
          <span style={{ color: "var(--color-danger)" }}>{result.counts.miss}</span>
        </div>
        <div className="result__stat" role="row">
          <span>Max combo</span>
          <span>{result.maxCombo}</span>
        </div>
        <div className="result__stat" role="row">
          <span>Accuracy</span>
          <span>{(result.accuracy * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
        {hasNext && result.cleared && (
          <button className="btn btn--primary" onClick={onNext}>
            Next stage
          </button>
        )}
        <button className="btn" onClick={onSandbox}>
          Sandbox
        </button>
        <button className="btn btn--ghost" onClick={onTitle}>
          Title
        </button>
      </div>
    </section>
  );
}

function gradeFor(r: StageResult): string {
  if (r.totalEvents === 0) return "-";
  const acc = r.accuracy;
  if (acc >= 0.95) return "S";
  if (acc >= 0.85) return "A";
  if (acc >= 0.7) return "B";
  if (acc >= 0.5) return "C";
  return "D";
}

function gradeColor(g: string): string {
  switch (g) {
    case "S":
      return "var(--color-acid)";
    case "A":
      return "var(--color-cyan)";
    case "B":
      return "var(--color-cash)";
    case "C":
      return "var(--color-warn)";
    case "D":
      return "var(--color-danger)";
    default:
      return "var(--color-text-dim)";
  }
}
