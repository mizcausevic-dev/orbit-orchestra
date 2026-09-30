export interface TutorialStep {
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "The system",
    body:
      "A star sits at the center. Planets orbit it at different speeds. The glowing radius at the top is the beat line, the gate where planets trigger their instruments.",
  },
  {
    title: "Read the rhythm",
    body:
      "Because each planet has a different period, crossings form a polyrhythm. Watch a planet approach the gate so you learn its tempo before pressing.",
  },
  {
    title: "Strike the key",
    body:
      "Each planet maps to a key shown in the legend (A, S, D, F, G). Press that key when its planet reaches the gate. The closer to the crossing, the better the judgement.",
  },
  {
    title: "Build a combo",
    body:
      "Clean hits in a row raise a combo multiplier up to 2x. A miss breaks the streak. You can pause with Escape or P at any time without losing timing.",
  },
  {
    title: "You are ready",
    body:
      "This tutorial stage runs a single slow planet so you can feel the timing. Hit the gate on each crossing. When you are comfortable, return to the title and start Stage I.",
  },
];

export function TutorialOverlay({
  step,
  total,
  onNext,
  onSkip,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const current = TUTORIAL_STEPS[step];
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      style={{ background: "rgba(7, 6, 10, 0.55)" }}
    >
      <h2 className="overlay__title" id="tutorial-title" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
        {current.title}
      </h2>
      <p className="tutorial__step">{current.body}</p>
      <div className="tutorial__progress" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={i === step ? "tutorial__dot tutorial__dot--active" : "tutorial__dot"}
          />
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn--ghost" onClick={onSkip}>
          Skip tutorial
        </button>
        <button className="btn btn--primary" onClick={onNext} autoFocus>
          {step + 1 < total ? "Next" : "Start playing"}
        </button>
      </div>
    </div>
  );
}
