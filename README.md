# Orbit Orchestra

Conduct planets in a miniature solar system. Each planet crosses a beat line on its own rhythm; strike the matching key at the crossing to trigger its instrument. A deterministic, audio-scheduled rhythm game built with React, TypeScript, Vite, Canvas, and the Web Audio API.

Original artwork and synthesized sound. No third-party assets, no audio files, no recognizable melodies. Inspired by the broad rhythm-game genre, not a clone of any specific title.

## What is in the slice

- **Title screen** with stage select, locked progression, best scores, and sandbox entry.
- **Tutorial** (5 steps) overlaid on a slow practice stage.
- **How to play** instructions screen.
- **Three challenge stages** with meaningful progression along three axes: planet count, orbital speed, and judgement-window width.
- **Sandbox** with live orbit-speed and instrument controls per planet.
- **Active gameplay**: Canvas-rendered solar system, beat-line gate, hit flashes, judgement popups, HUD with score/combo/timer.
- **Result screen** with grade, breakdown, retry, next stage, sandbox, and title.
- **Pause/resume** with frozen timing (resume never costs a beat).
- **Settings**: mute, visual-only mode, reduced motion, latency offset, master volume, reset, and a tap-based calibration routine.
- **Persistence**: settings and progress (best scores, unlocked stages, tutorial completion) in localStorage.
- **Accessibility**: keyboard controls, on-screen tap targets for mobile, focus-visible outlines, high-contrast dark theme, reduced-motion support, ARIA labels, and a fully playable silent (visual-only) mode.

## Architecture

```
src/
  audio/
    AudioEngine.ts     Web Audio wrapper: unlock, mute, visual-only, scheduling
    instruments.ts     Synthesized instrument specs (oscillator + envelope)
  game/
    types.ts           Shared types and defaults
    rng.ts             mulberry32 seeded PRNG (reproducible fixtures)
    planets.ts         Deterministic event generation from orbital periods
    scoring.ts         Pure judging, combo, and tally functions
    stages.ts          Stage definitions and progression
    engine.ts          Pure game-state machine (injectable clock)
  utils/
    timing.ts          GameClock: pause-aware, zero-based, audio-driven
    analytics.ts       Optional GA4 shim (no-op by default)
  hooks/
    useLocalStorage.ts SSR-safe persistence + cross-tab sync
    useSettings.ts     Settings state
    useProgress.ts     Best scores + unlock state
  components/
    renderer.ts        Pure Canvas draw function
    GameScreen.tsx     Owns engine, rAF loop, input, pause
    TitleScreen.tsx, InstructionsScreen.tsx, HUD.tsx, PauseOverlay.tsx,
    TutorialOverlay.tsx, SettingsPanel.tsx, CalibrationOverlay.tsx,
    SandboxControls.tsx, ResultScreen.tsx
  App.tsx              Top-level phase state machine
  main.tsx             Entry
tests/                 Vitest unit + integration tests
```

### Timing contract

The game never judges from CSS animation time. The only monotonic clock trusted for judging is `AudioContext.currentTime`.

- **Game clock** (`GameClock`): zero-based, pause-aware seconds derived from `AudioContext.currentTime`. Event times and input times are expressed in this clock.
- **Audio scheduling**: notes are scheduled at absolute `AudioContext.currentTime` values with a small lookahead so timing is sample-accurate and independent of the main-thread frame rate (the "A Tale of two clocks" pattern).
- **Input capture**: on keypress, `AudioContext.currentTime` is captured and converted to game time. The user-adjustable latency offset is subtracted before comparing to the event target time.
- **Determinism**: event lists are produced by a closed-form solution of the orbital-crossing equation, so the same stage config always yields the same events. The PRNG (`mulberry32`) is seeded and reproducible.

### Asset rights

| Asset class | Source | Rights |
|---|---|---|
| Code | Written for this project | MIT |
| Visuals | Original, drawn programmatically on Canvas | Original, no third-party |
| Audio | Synthesized live via Web Audio oscillators | Original, no samples |
| Fonts | System font stack only | No web fonts, zero licensing surface |

No GeoGuessr, Kahoot!, or Melatonin logos, artwork, audio, UI, or proprietary code are used. The game is inspired by the rhythm-game genre broadly, not by any specific title.

## Setup

Requirements: Node 18+ (built and tested on Node 24) and npm.

```bash
npm install
npm run dev          # start Vite dev server (http://localhost:5173)
npm run build        # type-check + production build to dist/
npm run preview      # serve the production build locally
npm test             # run the Vitest suite once
npm run test:watch   # watch mode
npm run typecheck    # type-check only
```

## Environment

The game is fully client-side and needs no environment variables to run. Copy `.env.example` to `.env` only if you want optional analytics:

```bash
cp .env.example .env
```

- `VITE_GA4_ID` (optional): a Google Analytics 4 measurement ID. If unset, no analytics script loads and no events are sent.
- `VITE_STORAGE_PREFIX` (optional): overrides the localStorage key prefix. Defaults to `orbit-orchestra`.

No secrets are required. Never commit a `.env` containing real keys.

## Tests

45 tests across 5 files cover the required surfaces:

- `scoring.test.ts` judging windows, combo multiplier, tally, nearest-event matching.
- `rng.test.ts` seed reproducibility, range/int/pick, string hashing.
- `events.test.ts` deterministic event generation, beat-line correctness, duration bounds, counts.
- `timer.test.ts` `GameClock` pause/resume/freeze, engine finished-state transitions, pause-prevents-auto-miss.
- `engine.test.ts` end-to-end happy path (perfect run clears with the exact combo-multiplier score), miss-all, early/late tolerance, latency-offset shift, sandbox horizon/no-miss.

Run them with `npm test`. All 45 pass at the time of writing.

## Deployment

The build output is static files in `dist/`. Deploy it to any static host.

### Netlify

```bash
npm install -g netlify
netlify deploy --dir=dist --prod
```

Or connect the repo in the Netlify UI with build command `npm run build` and publish directory `dist`.

### Vercel

```bash
npm install -g vercel
vercel --prod
```

### Hostinger / any static host

Upload the contents of `dist/` to your `public_html/` (or equivalent). Because `vite.config.ts` sets `base: "./"`, the build uses relative asset paths and works from any subdirectory, not just the domain root.

### GitHub Pages

Push `dist/` to a `gh-pages` branch or use a CI action. With `base: "./"`, it works under the default `<user>.github.io/<repo>/` path.

## API cost notes

There are no API costs. The game makes no network requests at runtime. The only optional network call is the GA4 script, which loads only if `VITE_GA4_ID` is set, and which is governed by your own GA4 account and quota. All audio is synthesized locally. All persistence is in the browser's localStorage.

## Privacy statement

- The game stores settings and progress (best scores, unlocked stages, tutorial completion) in your browser's localStorage. This data never leaves your device.
- No account, no server, no telemetry is required to play.
- If `VITE_GA4_ID` is set at build time, a standard GA4 script loads and sends a single `oo_screen` event with a screen name (no stage scores, no audio, no timing data, no personally identifiable information). Google's privacy practices then apply. If `VITE_GA4_ID` is unset, no analytics script loads and no events are sent.
- No third-party fonts, images, audio, or trackers are loaded.

## Unverified assumptions

These are assumptions made during the build that should be confirmed before any public launch claim:

1. **Audio latency model.** The latency offset is a single global millisecond value applied to all inputs. It does not model separate input-device latency and output-device latency, which differ in practice. Calibration measures the combined round-trip offset against the metronome.
2. **Clock drift.** `AudioContext.currentTime` and `performance.now()` are assumed to advance at the same rate. In rare drivers they can drift slightly over long sessions; the game re-samples `AudioContext.currentTime` every frame so drift does not accumulate in game time, but very long sandbox sessions (tens of minutes) could show sub-millisecond drift.
3. **Mobile audio unlock.** Audio is unlocked on the first user gesture (pointer/keydown). Some mobile browsers additionally require the gesture to be on a visible control; the title-screen buttons satisfy this, but autoplay-before-gesture will not produce sound.
4. **Reduced motion.** The CSS `prefers-reduced-motion` gate collapses decorative animation. Planet orbital motion is intentionally preserved because it is the game itself; the setting only removes trails, glow pulsing, and popup animation.
5. **Browser support.** Tested via Vitest + jsdom for logic and a Vite production build. Not manually tested across browsers. Web Audio API and Canvas are supported in all current evergreen browsers; iOS Safari requires the gesture-based unlock already implemented.
6. **Stage balance.** Target scores and judgement windows are hand-tuned, not derived from playtest data. They are reasonable starting points, not validated difficulty curves.
7. **No live API or licensed asset is used**, so no demo fixtures are required for runtime. The test suite uses synthetic fixtures (a controllable clock and synthetic inputs) in place of a live API.

## License

MIT. See `LICENSE` if added; otherwise treat the code in this repository as MIT-licensed original work.
