import type { Settings } from "../game/types";

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onReset,
  onCalibrate,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onReset: () => void;
  onCalibrate: () => void;
}) {
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <h2 className="overlay__title" id="settings-title">
        Settings
      </h2>
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="settings__row">
          <div>
            <div className="settings__label">Mute</div>
            <div className="settings__hint">Silence all audio output.</div>
          </div>
          <input
            type="checkbox"
            className="toggle"
            checked={settings.muted}
            onChange={(e) => onChange({ muted: e.target.checked })}
            aria-label="Mute audio"
          />
        </div>

        <div className="settings__row">
          <div>
            <div className="settings__label">Visual-only mode</div>
            <div className="settings__hint">
              No audio is scheduled. Gameplay is judged from visual timing. Safe
              for silent environments.
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle"
            checked={settings.visualOnly}
            onChange={(e) => onChange({ visualOnly: e.target.checked })}
            aria-label="Visual only mode"
          />
        </div>

        <div className="settings__row">
          <div>
            <div className="settings__label">Reduced motion</div>
            <div className="settings__hint">
              Disable planet trails and decorative animation. Planets still
              orbit because that is the game.
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle"
            checked={settings.reducedMotion}
            onChange={(e) => onChange({ reducedMotion: e.target.checked })}
            aria-label="Reduced motion"
          />
        </div>

        <div className="settings__row">
          <div>
            <div className="settings__label">Latency offset</div>
            <div className="settings__hint">
              Milliseconds subtracted from your input time. Increase if your
              hits register late. Current: {settings.latencyOffsetMs} ms.
            </div>
          </div>
          <input
            type="range"
            className="range"
            min={-200}
            max={200}
            step={5}
            value={settings.latencyOffsetMs}
            onChange={(e) => onChange({ latencyOffsetMs: Number(e.target.value) })}
            aria-label="Latency offset in milliseconds"
          />
        </div>

        <div className="settings__row">
          <div>
            <div className="settings__label">Master volume</div>
            <div className="settings__hint">
              {Math.round(settings.volume * 100)}%
            </div>
          </div>
          <input
            type="range"
            className="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
            aria-label="Master volume"
          />
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onCalibrate}>
            Run calibration
          </button>
          <button className="btn btn--danger" onClick={onReset}>
            Reset settings
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
