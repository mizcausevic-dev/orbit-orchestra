// Settings persistence. Settings live in localStorage under the configured
// prefix and are also mirrored to the AudioEngine at runtime.

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_SETTINGS, STORAGE_PREFIX, type Settings } from "../game/types";

const SETTINGS_KEY = `${STORAGE_PREFIX}:settings:v1`;

export interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export function useSettings(): SettingsApi {
  const [settings, setSettings] = useLocalStorage<Settings>(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  );

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  return useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
}
