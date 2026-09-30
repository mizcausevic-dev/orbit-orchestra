// Vitest setup. Polyfills the browser APIs the engine and audio layer need so
// the pure-logic tests can run in jsdom without a real AudioContext.
//
// AudioContext is replaced with a FakeAudioContext whose currentTime is driven
// by a controllable clock. Tests that need determinism set the clock explicitly.

export class FakeAudioContext {
  private _currentTime = 0;
  readonly state: "running" = "running";
  readonly sampleRate = 44100;
  readonly destination = { channelCount: 2 };

  get currentTime(): number { return this._currentTime; }

  /** Test helper: advance the fake clock by `seconds`. */
  tick(seconds: number): void { this._currentTime += seconds; }

  /** Test helper: set the clock to an absolute time. */
  setTime(t: number): void { this._currentTime = t; }

  async resume(): Promise<void> { /* no-op */ }
  async suspend(): Promise<void> { /* no-op */ }
  async close(): Promise<void> { /* no-op */ }

  createOscillator(): object { return { type: "sine", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {}, connect() {} }; }
  createGain(): object { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, connect() {} }; }
  createBiquadFilter(): object { return { type: "lowpass", frequency: { value: 1000 }, connect() {} }; }
  createBuffer(channels: number, length: number, _rate: number): object {
    return { getChannelData: () => new Float32Array(length), numberOfChannels: channels, length };
  }
  createBufferSource(): object {
    return { buffer: null, start() {}, stop() {}, connect() {} };
  }
}

// Install globals used by the audio layer and storage.
(globalThis as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext;

// jsdom lacks setInterval/setInterval in some configs; ensure present.
if (typeof globalThis.setInterval === "undefined") {
  (globalThis as unknown as { setInterval: typeof setInterval }).setInterval = setInterval;
  (globalThis as unknown as { clearInterval: typeof clearInterval }).clearInterval = clearInterval;
}

// localStorage is provided by jsdom. If missing, install an in-memory shim.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
}
