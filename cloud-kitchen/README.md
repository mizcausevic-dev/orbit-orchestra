# Cloud Kitchen

An original browser rhythm game. Compose surreal breakfast orders by following animated ingredient arcs in time with procedurally synthesized music. Solo and remix modes, a level builder with shareable codes, calibration, practice mode, and a visual-only option.

**Original work.** Not a clone. No third-party logos, artwork, audio, or proprietary code. All music is synthesized at runtime from the Web Audio API, so there are zero audio rights to clear.

## Stack

- **React 18 + TypeScript 5** — UI and game state
- **Vite 5** — dev server and production build
- **Canvas 2D** — gameplay rendering (ingredient arcs, plates, judgement popups)
- **Web Audio API** — all sound, scheduled against `AudioContext.currentTime`
- **Vitest** — unit and end-to-end tests
- **localStorage** — settings and progress persistence (no server, no account, no telemetry)

## Architecture

```
src/
  audio/
    AudioEngine.ts     Owns the AudioContext. Look-ahead scheduler (25ms wake, 100ms horizon).
    Synth.ts           Oscillator + noise voices. All scheduling against audio clock.
    MusicGenerator.ts  Deterministic music events from a level seed.
  game/
    types.ts           Shared types (Beat, Level, ScoreResult, Settings, GamePhase).
    seed.ts            mulberry32 PRNG + string hash. Deterministic.
    timing.ts          Pure timing helpers. Latency offset applied here.
    scoring.ts         Pure scoring. Judgement windows, combo, grade. No DOM.
    levels.ts         Three built-in levels, beat generator, schema validator, share encode/decode.
    engine.ts          GameEngine state machine. Testable with an injected clock.
  components/
    renderer.ts        Canvas drawing. Pure: takes a snapshot, draws a frame.
    TitleScreen, Instructions, LevelSelect, GameScreen, ResultScreen,
    LevelBuilder, SettingsPanel.tsx
  state/
    storage.ts         localStorage read/write with graceful degradation.
  tests/
    setup.ts           jsdom polyfills (FakeAudioContext, localStorage).
    scoring, timing, seed, state, e2e .test.ts
```

### Timing contract (the core invariant)

All judgment uses `AudioContext.currentTime` as the monotonic clock. CSS and canvas animation are purely visual. When the song starts, the engine records `songStartAudioTime = audioContext.currentTime + leadIn`. Each beat's absolute target time is `songStartAudioTime + beat.time`. Player input is judged as:

```
delta = inputAudioTime - latencyOffset - (songStartAudioTime + beat.time)
```

The user-adjustable `latencyOffset` is subtracted from the input time before judging, so a positive offset shifts hits earlier. The scheduler uses the standard "A Tale of Two Clocks" look-ahead pattern: a 25ms `setInterval` wakes the scheduler, which schedules every music event whose absolute time falls within the next 100ms. This decouples musical timing from main-thread jitter.

### Scoring

Each judged event contributes `MAX_SCORE / totalEvents` scaled by its judgement weight (`perfect=1.0`, `great=0.7`, `good=0.4`, `miss=0.0`) and a live combo multiplier (`1.0` + `0.02` per 10-combo, capped at `1.5`). Accuracy is `(perfect + great + good) / total`. Grade S requires a full combo and >= 95% accuracy; A/B/C/D follow accuracy thresholds.

### Beat types

- **tap** — one hit event at `beat.time`.
- **hold** — two events: `hold-start` on press, `hold-end` on release (judged at `beat.time + duration`).
- **two-step** — two tap events: at `beat.time` and `beat.time + stepGap`.

## Setup

Requirements: Node 18+ (built and tested on Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build to dist/
npm run preview      # serve the production build locally
npm test             # run the Vitest suite once
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
```

## Environment variables

None required. The game is fully client-side. See `.env.example` for two optional public configuration values used only if you wire up an external level-share endpoint. No secrets are read or shipped.

## Deployment

The build output in `dist/` is static and can be served by any static host.

- **Netlify:** build command `npm run build`, publish directory `dist`. No adapter needed; this is a plain Vite SPA.
- **Vercel:** framework preset "Vite", output directory `dist`.
- **Hostinger / any static host:** upload the contents of `dist/` to your document root.
- **Local preview:** `npm run preview --host` serves the build on a local port.

The `vite.config.ts` ships a strict Content-Security-Policy (`default-src 'self'`) because the game loads no external resources. If you add an external share endpoint, update the `connect-src` directive.

## API cost notes

None. The game has no backend, no external API calls, and no AI features. All music is synthesized locally. The only optional external call is the level-share endpoint, which you control.

## Privacy

- No account, no server, no analytics, no telemetry.
- Settings (latency offset, mute, volume, visual-only, reduced motion) and progress (best scores and grades per level, cleared-level list) are stored only in the user's `localStorage` on their device.
- No personal data is collected, transmitted, or shared.
- The game works offline once loaded.

## Tests

50 tests across 5 files, all passing:

- `scoring.test.ts` — judgement windows, latency offset, combo, aggregation, grades.
- `timing.test.ts` — beat/audio conversion, delta, latency offset, BPM, quantization.
- `seed.test.ts` — PRNG determinism, beat/music reproducibility from a seed.
- `state.test.ts` — settings/progress persistence, corruption recovery, result recording.
- `e2e.test.ts` — full perfect run through all three levels with a fake clock, state transitions, level validation, and encode/decode round-trip.

The end-to-end test drives `GameEngine` with a fake monotonic clock, fires perfect inputs at every event's exact hit time, and asserts a full-combo S grade on all three built-in levels. It also covers the all-miss path (D grade) and the abort path.

## Accessibility

- Keyboard controls: lane keys `D F J K` (or `1 2 3 4`), `Esc`/`P` to pause.
- Touch input: tap directly on the lane in the gameplay area.
- `prefers-reduced-motion` is detected and followed; arcs flatten and animations minimize.
- Visible focus styles, ARIA labels on interactive controls, `role="application"` on the gameplay area.
- High-contrast dark theme with a cyan accent.
- Responsive layout: the gameplay area reflows for mobile portrait.

## Asset rights

- **Real:** none. No real brands, people, or licensed assets are used.
- **Fictional:** all in-game content (ingredient names, level names, the "Cloud Kitchen" theme) is original and fictional.
- **Licensed:** none. All audio is synthesized at runtime from the Web Audio API. No audio files are shipped. No fonts are loaded externally (system font stacks approximate JetBrains Mono / Space Grotesk). No images are shipped.

The rhythm-game genre is broad and uncopyrightable; only specific expression is protected, and none from any existing game is used. This project is not affiliated with, and does not reference, GeoGuessr, Kahoot!, or Melatonin.

## Unverified assumptions

- The Web Audio API is available and `AudioContext` can be resumed on a user gesture. True in all modern browsers but not guaranteed in older or embedded webviews.
- `requestAnimationFrame` runs at a reasonable rate for the visual loop. The visual loop is decoupled from scoring, so frame drops affect visuals only, not judgment.
- `localStorage` is writable. The storage layer degrades to in-memory if it is not (private mode, disabled storage), so progress will not persist in that case.
- The `TextEncoder`/`TextDecoder`/`btoa`/`atob` globals are available. True in all modern browsers and jsdom.
- The built-in level generator produces playable patterns. It is simple and deterministic; it has not been playtested by humans. Adjust the seed or build a custom level if a generated level feels off.
- The calibration tool's suggested offset is a reasonable starting point. Real audio latency varies by device, output, and OS; the user should verify by playing.
- The default judgement windows (50/100/150/200ms) suit casual play. They are not derived from playtesting. Tighten them in `src/game/timing.ts` for a harder game.

## Demo fixtures

No live API or licensed asset is used, so no demo fixtures are required. The three built-in levels (`Sunny Side Up`, `Bacon Wave`, `Pancake Stack`) serve as the bundled, deterministic demo content. They are generated from fixed seeds and validated by the test suite.
