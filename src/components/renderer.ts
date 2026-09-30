// Pure canvas renderer. Takes a CanvasRenderingContext2D and a scene
// description and draws one frame. Kept separate from React so it can be
// called directly from the rAF loop without triggering React re-renders,
// and so the draw logic could in principle be unit-tested against a
// recording 2D context.

import type { PlanetConfig, ScheduledEvent } from "../game/types";
import { BEAT_LINE_ANGLE, planetAngle, planetPosition } from "../game/planets";

export interface HitFlash {
  planetId: number;
  /** Game time seconds when the flash started. */
  startedAt: number;
  judgement: "perfect" | "great" | "good" | "miss";
}

export interface DrawParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  planets: PlanetConfig[];
  gameTime: number;
  /** Events within the visible lookahead window, for showing approaching
   * notes on the beat line. */
  upcoming: ScheduledEvent[];
  flashes: HitFlash[];
  reducedMotion: boolean;
  /** Beat-line highlight intensity 0..1, driven by the nearest upcoming
   * event so the gate "breathes" as a note approaches. */
  beatPulse: number;
  /** Whether the beat-line gate is currently "open" (an event is within the
   * perfect window). */
  gateOpen: boolean;
}

const FLASH_DURATION = 0.5;

const JUDGE_COLOR: Record<HitFlash["judgement"], string> = {
  perfect: "#d6ff3f",
  great: "#66fcf1",
  good: "#ffb454",
  miss: "#ff5277",
};

export function drawScene(p: DrawParams): void {
  const { ctx, width, height, planets, gameTime, flashes, reducedMotion } = p;
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2;
  // Scale planet radii so the system fits any viewport. The stage configs
  // use radii up to ~315 display units; we map that range onto the available
  // half-extent with a small margin.
  const maxR = planets.reduce((m, pl) => Math.max(m, pl.radius), 0) || 1;
  const rScale = (scale * 0.82) / maxR;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Subtle radial vignette background.
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale);
  bg.addColorStop(0, "rgba(26, 22, 38, 0.35)");
  bg.addColorStop(1, "rgba(7, 6, 10, 0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Orbit rings.
  ctx.lineWidth = Math.max(1, 1 * p.dpr);
  for (const pl of planets) {
    ctx.beginPath();
    ctx.arc(cx, cy, pl.radius * rScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(184, 174, 203, 0.18)";
    ctx.stroke();
  }

  // Beat line: a radius from center to the top, with a "gate" marker at the
  // outer edge where planets cross.
  const beatLen = (maxR + 28) * rScale;
  const bx = cx + Math.cos(BEAT_LINE_ANGLE) * beatLen;
  const by = cy + Math.sin(BEAT_LINE_ANGLE) * beatLen;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = p.gateOpen
    ? "rgba(214, 255, 63, 0.9)"
    : `rgba(102, 252, 241, ${0.35 + p.beatPulse * 0.5})`;
  ctx.lineWidth = (p.gateOpen ? 3 : 2) * p.dpr;
  ctx.stroke();

  // Gate marker at the beat line.
  const gateR = (10 + p.beatPulse * 6) * p.dpr;
  ctx.beginPath();
  ctx.arc(bx, by, gateR, 0, Math.PI * 2);
  ctx.fillStyle = p.gateOpen
    ? "rgba(214, 255, 63, 0.25)"
    : `rgba(102, 252, 241, ${0.1 + p.beatPulse * 0.2})`;
  ctx.fill();
  ctx.lineWidth = 2 * p.dpr;
  ctx.strokeStyle = p.gateOpen ? "#d6ff3f" : "#66fcf1";
  ctx.stroke();

  // Central star.
  const starR = 14 * p.dpr;
  const starPulse = reducedMotion ? 1 : 1 + 0.06 * Math.sin(gameTime * 2.2);
  ctx.beginPath();
  ctx.arc(cx, cy, starR * starPulse, 0, Math.PI * 2);
  const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR * 2);
  starGrad.addColorStop(0, "#ffe9a8");
  starGrad.addColorStop(0.5, "rgba(255, 233, 168, 0.6)");
  starGrad.addColorStop(1, "rgba(255, 233, 168, 0)");
  ctx.fillStyle = starGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff7d6";
  ctx.fill();

  // Planets.
  for (const pl of planets) {
    const angle = planetAngle(pl, gameTime);
    const pos = planetPosition(pl, angle, cx, cy);
    const px = pos.x;
    const py = pos.y;
    const pr = (8 + (pl.id % 3) * 1.5) * p.dpr;

    // Trail (skipped in reduced motion).
    if (!reducedMotion) {
      const trailSteps = 14;
      for (let i = 1; i <= trailSteps; i++) {
        const t = gameTime - i * 0.03;
        const a = planetAngle(pl, t);
        const tp = planetPosition(pl, a, cx, cy);
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, pr * (1 - i / trailSteps) * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = hexWithAlpha(pl.color, 0.05 * (1 - i / trailSteps));
        ctx.fill();
      }
    }

    // Glow.
    ctx.beginPath();
    ctx.arc(px, py, pr * 2.2, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr * 2.2);
    g.addColorStop(0, hexWithAlpha(pl.color, 0.55));
    g.addColorStop(1, hexWithAlpha(pl.color, 0));
    ctx.fillStyle = g;
    ctx.fill();

    // Body.
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = pl.color;
    ctx.fill();
    ctx.lineWidth = 1.5 * p.dpr;
    ctx.strokeStyle = "rgba(7, 6, 10, 0.5)";
    ctx.stroke();

    // Label.
    ctx.fillStyle = "rgba(7, 6, 10, 0.85)";
    ctx.font = `${10 * p.dpr}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pl.label, px, py);
  }

  // Hit flashes at the beat line.
  for (const f of flashes) {
    const age = gameTime - f.startedAt;
    if (age < 0 || age > FLASH_DURATION) continue;
    const t = age / FLASH_DURATION;
    const radius = (10 + t * 60) * p.dpr;
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexWithAlpha(JUDGE_COLOR[f.judgement], (1 - t) * 0.8);
    ctx.lineWidth = (3 * (1 - t) + 1) * p.dpr;
    ctx.stroke();
  }

  ctx.restore();
}

function hexWithAlpha(color: string, alpha: number): string {
  // Accept #rgb or #rrggbb. Returns an rgba() string.
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
