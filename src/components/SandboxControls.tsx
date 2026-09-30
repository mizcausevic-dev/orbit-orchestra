import type { PlanetConfig, InstrumentId } from "../game/types";
import { INSTRUMENT_ORDER } from "../game/stages";

export interface SandboxPlanetState {
  period: number;
  instrument: InstrumentId;
}

export function SandboxControls({
  planets,
  state,
  onChange,
}: {
  planets: PlanetConfig[];
  state: SandboxPlanetState[];
  onChange: (index: number, patch: Partial<SandboxPlanetState>) => void;
}) {
  return (
    <div className="sandbox__controls" role="group" aria-label="Sandbox controls">
      {planets.map((pl, i) => {
        const s = state[i];
        return (
          <div className="sandbox__planet-row" key={pl.id}>
            <span
              className="key-chip__dot"
              style={{ color: pl.color, background: pl.color }}
              aria-hidden="true"
            />
            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor={`sb-speed-${pl.id}`}>
                {pl.label} speed ({pl.key.toUpperCase()}) &middot; {s.period.toFixed(2)}s
              </label>
              <input
                id={`sb-speed-${pl.id}`}
                type="range"
                className="range"
                min={0.4}
                max={6}
                step={0.05}
                value={s.period}
                onChange={(e) =>
                  onChange(i, { period: Number(e.target.value) })
                }
                aria-label={`${pl.label} orbital period in seconds`}
              />
            </div>
            <select
              className="select"
              value={s.instrument}
              onChange={(e) =>
                onChange(i, { instrument: e.target.value as InstrumentId })
              }
              aria-label={`${pl.label} instrument`}
            >
              {INSTRUMENT_ORDER.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
