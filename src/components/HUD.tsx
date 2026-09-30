import type { Judgement } from "../game/types";

export interface JudgePopup {
  id: number;
  judgement: Judgement;
}

export function HUD({
  score,
  combo,
  timer,
  timerLabel,
  popups,
}: {
  score: number;
  combo: number;
  timer: number;
  timerLabel: string;
  popups: JudgePopup[];
}) {
  return (
    <>
      <div className="hud" aria-hidden="true">
        <div className="hud__block">
          <span className="hud__label">Score</span>
          <span className="hud__value">{score.toLocaleString()}</span>
        </div>
        <div className="hud__block">
          <span className="hud__label">{timerLabel}</span>
          <span className="hud__value hud__timer">{formatTimer(timer)}</span>
        </div>
        <div className="hud__block">
          <span className="hud__label">Combo</span>
          <span className="hud__value hud__combo">{combo}</span>
        </div>
      </div>
      <div className="judge-stack" aria-live="polite">
        {popups.map((p) => (
          <div key={p.id} className={`judge judge--${p.judgement}`}>
            {p.judgement === "miss" ? "Miss" : labelFor(p.judgement)}
          </div>
        ))}
      </div>
    </>
  );
}

function labelFor(j: Judgement): string {
  return j.charAt(0).toUpperCase() + j.slice(1);
}

function formatTimer(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
