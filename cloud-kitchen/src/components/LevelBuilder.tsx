import { useMemo, useState } from "react";
import {
  BUILT_IN_LEVELS,
  encodeLevel,
  generateBeats,
  normalizeLevel,
  validateLevel,
  type ValidationResult,
} from "../game/levels";
import type { Beat, Level } from "../game/types";

interface LevelBuilderProps {
  onPlay: (level: Level) => void;
  onBack: () => void;
  onImport: (code: string) => ValidationResult;
  showToast: (msg: string) => void;
}

interface BuilderState {
  id: string;
  name: string;
  difficulty: Level["difficulty"];
  bpm: number;
  key: number;
  leadIn: number;
  length: number;
  lanes: number;
  seed: number;
  density: number;
}

const DEFAULT_STATE: BuilderState = {
  id: `custom-${Date.now().toString(36)}`,
  name: "My Remix",
  difficulty: "Custom",
  bpm: 100,
  key: 0,
  leadIn: 2,
  length: 24,
  lanes: 3,
  seed: Math.floor(Math.random() * 1_000_000),
  density: 0.6,
};

export function LevelBuilder({ onPlay, onBack, onImport, showToast }: LevelBuilderProps) {
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [shareCode, setShareCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importResult, setImportResult] = useState<ValidationResult | null>(null);

  // Build the level from the current builder state. Deterministic from seed.
  const builtLevel = useMemo<Level>(() => {
    const template: Omit<Level, "beats"> = {
      schemaVersion: 1,
      id: state.id,
      name: state.name || "Untitled Remix",
      difficulty: state.difficulty,
      bpm: state.bpm,
      key: state.key,
      scale: [0, 2, 4, 5, 7, 9, 11],
      leadIn: state.leadIn,
      length: state.length,
      lanes: state.lanes,
      seed: state.seed,
      author: "You",
    };
    // Use the same generator as built-in levels, then apply density by
    // filtering. This keeps the builder simple and the output valid.
    const full = generateBeats(template);
    const beats: Beat[] = filterByDensity(full, state.density, state.seed);
    return normalizeLevel({ ...template, beats });
  }, [state]);

  const validation = useMemo(() => validateLevel(builtLevel), [builtLevel]);

  const update = (patch: Partial<BuilderState>) => setState((s) => ({ ...s, ...patch }));

  const handleShare = async () => {
    const code = encodeLevel(builtLevel);
    setShareCode(code);
    const importResultLocal = onImport(code);
    if (importResultLocal.ok) {
      showToast("Level added to your list and code copied below.");
    }
    try {
      await navigator.clipboard?.writeText(code);
      showToast("Share code copied to clipboard.");
    } catch {
      // Clipboard may be unavailable; the code is shown in the textarea.
    }
  };

  const handleImport = () => {
    if (!importCode.trim()) return;
    const r = onImport(importCode.trim());
    setImportResult(r);
    if (r.ok) {
      setImportCode("");
      showToast("Imported. Play it from the level menu.");
    }
  };

  const handlePlay = () => {
    if (!validation.ok) return;
    onPlay(builtLevel);
  };

  const handleRandomSeed = () => {
    update({ seed: Math.floor(Math.random() * 1_000_000), id: `custom-${Date.now().toString(36)}` });
  };

  return (
    <section className="panel" aria-labelledby="builder-heading">
      <div className="app-header" style={{ marginBottom: 8 }}>
        <h2 id="builder-heading" style={{ margin: 0 }}>Level builder</h2>
        <button className="btn btn--ghost" onClick={onBack}>Back</button>
      </div>

      <p className="muted" style={{ lineHeight: 1.6, maxWidth: 620 }}>
        Design a remix by setting the musical parameters and a density. Beats are generated
        deterministically from your seed, so the same settings always produce the same level.
        Export a share code, or import one from a friend. Every level is validated against the
        schema before it can be played or shared.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", marginTop: 18 }}>
        <div className="field">
          <label htmlFor="b-name">Name</label>
          <input id="b-name" value={state.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="b-diff">Difficulty</label>
          <select id="b-diff" value={state.difficulty} onChange={(e) => update({ difficulty: e.target.value as Level["difficulty"] })}>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-bpm">BPM ({state.bpm})</label>
          <input id="b-bpm" type="range" min={60} max={200} value={state.bpm} onChange={(e) => update({ bpm: parseInt(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="b-lanes">Lanes ({state.lanes})</label>
          <input id="b-lanes" type="range" min={1} max={4} value={state.lanes} onChange={(e) => update({ lanes: parseInt(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="b-length">Length ({state.length}s)</label>
          <input id="b-length" type="range" min={12} max={90} value={state.length} onChange={(e) => update({ length: parseInt(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="b-density">Density ({Math.round(state.density * 100)}%)</label>
          <input id="b-density" type="range" min={0.2} max={1} step={0.05} value={state.density} onChange={(e) => update({ density: parseFloat(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="b-key">Key (semitones from A4)</label>
          <input id="b-key" type="number" min={-12} max={12} value={state.key} onChange={(e) => update({ key: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label htmlFor="b-seed">Seed</label>
          <div className="btn-row">
            <input id="b-seed" type="number" value={state.seed} onChange={(e) => update({ seed: parseInt(e.target.value) || 0 })} style={{ flex: 1 }} />
            <button className="btn btn--ghost" onClick={handleRandomSeed}>Randomize</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="btn-row">
          <button className="btn btn--primary" onClick={handlePlay} disabled={!validation.ok}>
            Play this level
          </button>
          <button className="btn" onClick={handleShare}>Generate share code</button>
        </div>
        {!validation.ok && (
          <div className="error" role="alert" style={{ marginTop: 8 }}>
            {validation.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div className="warn" style={{ marginTop: 8 }}>
            {validation.warnings.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 10 }}>
          Preview: {builtLevel.beats.length} beats · {builtLevel.bpm} BPM · {builtLevel.lanes} lanes
        </div>
      </div>

      {shareCode && (
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="share-out">Share code (send this to a friend)</label>
          <textarea id="share-out" readOnly value={shareCode} />
        </div>
      )}

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 style={{ color: "var(--cyan)", margin: "0 0 8px" }}>Import a level</h3>
        <div className="field">
          <label htmlFor="import-in">Paste a share code</label>
          <textarea id="import-in" value={importCode} onChange={(e) => setImportCode(e.target.value)} placeholder="Paste a Cloud Kitchen level code..." />
          <div className="btn-row">
            <button className="btn" onClick={handleImport} disabled={!importCode.trim()}>Import</button>
          </div>
          {importResult && !importResult.ok && (
            <div className="error" role="alert">
              {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 style={{ color: "var(--cyan)", margin: "0 0 8px" }}>Built-in levels (read-only reference)</h3>
        <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {BUILT_IN_LEVELS.map((l) => `${l.name} (${l.beats.length} beats)`).join(" · ")}
        </div>
      </div>
    </section>
  );
}

/** Filter generated beats by density using a deterministic PRNG. */
function filterByDensity(beats: Beat[], density: number, seed: number): Beat[] {
  if (density >= 1) return beats;
  // Deterministic keep/drop using a fresh PRNG seeded from the level seed.
  let h = seed >>> 0;
  const rng = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return beats.filter(() => rng() < density);
}
