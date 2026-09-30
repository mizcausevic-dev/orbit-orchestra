import "@testing-library/jest-dom";

// jsdom does not implement AudioContext or requestAnimationFrame by default.
// Provide minimal stubs so any module that references them at import time
// does not crash. The engine and clock tests inject their own fake clocks
// and never touch the real AudioContext.

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination: GainNode;
  sampleRate = 44100;
  constructor() {
    this.destination = new FakeGainNode() as unknown as GainNode;
  }
  createGain() {
    return new FakeGainNode() as unknown as GainNode;
  }
  createOscillator() {
    return new FakeOscillator() as unknown as OscillatorNode;
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
}

class FakeGainNode {
  gain = {
    value: 1,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {},
  };
  private nodes: AudioNode[] = [];
  connect(node: AudioNode) {
    this.nodes.push(node);
    return node;
  }
  disconnect() {}
}

class FakeOscillator {
  type: OscillatorType = "sine";
  frequency = { setValueAtTime: () => {}, value: 440 };
  connect(node: AudioNode) {
    return node;
  }
  start() {}
  stop() {}
  disconnect() {}
}

// @ts-expect-error augmenting the global with a fake
globalThis.AudioContext = FakeAudioContext;
// @ts-expect-error augmenting the global with a fake
globalThis.webkitAudioContext = FakeAudioContext;

// requestAnimationFrame stub that just calls back on next tick.
let rafId = 0;
const rafQueue = new Map<number, FrameRequestCallback>();
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = ++rafId;
  rafQueue.set(id, cb);
  return id;
};
globalThis.cancelAnimationFrame = (id: number) => {
  rafQueue.delete(id);
};

// ResizeObserver stub.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

// matchMedia stub for prefers-reduced-motion queries if any.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// localStorage is provided by jsdom already.
