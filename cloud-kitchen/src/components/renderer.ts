// Canvas renderer for the gameplay screen. Pure drawing functions — no state
// of its own. The GameScreen component calls renderFrame() each animation
// frame with the current snapshot.
//
// Visual model: each lane is a vertical column. Ingredients fall from the top
// toward a "plate" hit line near the bottom. The player presses when the
// ingredient lands on the plate. A slight horizontal sway makes the path an
// arc rather than a straight drop; the sway is removed in reduced-motion mode.

import type { EngineSnapshot, HitEvent } from "../game/engine";
import type { Level, Settings } from "../game/types";

const LOOKAHEAD_S = 2.0; // ingredients appear this many seconds before their hit time
const INGREDIENT_COLORS = [
  "#fff7e0", // egg — warm white
  "#ff7a8a", // bacon — pink-red
  "#d9a35a", // toast — tan
  "#e0a44a", // pancake — golden
  "#6a7cff", // blueberry — indigo
  "#ffd84d", // butter — yellow
  "#c97a2b", // syrup — amber
  "#caa15a", // waffle — wheat
];
const INGREDIENT_LABELS = ["E", "B", "T", "P", "U", "b", "S", "W"];

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  level: Level;
  snapshot: EngineSnapshot;
  settings: Settings;
  /** Recent judgements to pop near the hit line. */
  recentJudgements: Array<{ lane: number; judgement: string; age: number }>;
  /** Lanes currently held down by the player (for plate highlight). */
  activeLanes: Set<number>;
}

export function renderFrame(input: RenderInput): void {
  const { ctx, width, height, level, snapshot, settings, recentJudgements, activeLanes } = input;
  ctx.clearRect(0, 0, width, height);

  // Background grid (subtle).
  drawGrid(ctx, width, height);

  const lanes = level.lanes;
  const laneWidth = width / lanes;
  const hitLineY = height * 0.82;
  const topY = 0;

  // Lane separators and plates.
  for (let i = 0; i < lanes; i++) {
    const x = i * laneWidth;
    ctx.strokeStyle = "rgba(102,252,241,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Plate at the hit line.
    const isActive = activeLanes.has(i);
    ctx.fillStyle = isActive ? "rgba(102,252,241,0.22)" : "rgba(102,252,241,0.06)";
    ctx.fillRect(x + 4, hitLineY - 18, laneWidth - 8, 36);
    ctx.strokeStyle = isActive ? "#66fcf1" : "rgba(102,252,241,0.35)";
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.strokeRect(x + 4, hitLineY - 18, laneWidth - 8, 36);
  }
  // Right edge.
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width, height);
  ctx.stroke();

  // Hit line glow.
  const grad = ctx.createLinearGradient(0, hitLineY - 2, 0, hitLineY + 2);
  grad.addColorStop(0, "rgba(102,252,241,0)");
  grad.addColorStop(0.5, "rgba(102,252,241,0.5)");
  grad.addColorStop(1, "rgba(102,252,241,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, hitLineY - 2, width, 4);

  // Ingredients (pending events within the lookahead window).
  const songPos = snapshot.songPosition;
  for (const ev of snapshot.pendingEvents) {
    const dt = ev.time - songPos; // seconds until hit
    if (dt > LOOKAHEAD_S || dt < -0.25) continue;
    if (ev.kind === "hold-end") continue; // drawn as part of the hold-start

    const progress = 1 - dt / LOOKAHEAD_S; // 0 at spawn, 1 at hit
    const y = topY + (hitLineY - topY) * progress;
    const baseX = ev.lane * laneWidth + laneWidth / 2;
    const sway = settings.reducedMotion ? 0 : Math.sin(progress * Math.PI) * laneWidth * 0.12;
    const x = baseX + sway * (ev.lane % 2 === 0 ? 1 : -1);

    drawIngredient(ctx, x, y, laneWidth * 0.32, ev, settings);

    // Hold tail: a trailing bar from the start to the end event.
    if (ev.kind === "hold-start") {
      const beat = level.beats.find((b) => b.id === ev.beatId);
      const dur = beat?.duration ?? 0;
      if (dur > 0) {
        const tailProgress = Math.min(1, (songPos - ev.time) / dur);
        const tailEndY = y + (hitLineY - topY) * (dur / LOOKAHEAD_S);
        ctx.strokeStyle = "rgba(102,252,241,0.4)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, tailEndY);
        ctx.stroke();
        if (tailProgress > 0 && tailProgress < 1) {
          ctx.fillStyle = "rgba(214,255,63,0.7)";
          ctx.beginPath();
          ctx.arc(x, y + (tailEndY - y) * tailProgress, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Judgement popups.
  for (const j of recentJudgements) {
    const x = j.lane * laneWidth + laneWidth / 2;
    const y = hitLineY - 40 - j.age * 40;
    const alpha = Math.max(0, 1 - j.age);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colorForJudgement(j.judgement);
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(labelForJudgement(j.judgement), x, y);
    ctx.globalAlpha = 1;
  }

  // Song position bar.
  const songFrac = Math.max(0, Math.min(1, songPos / level.length));
  ctx.fillStyle = "rgba(102,252,241,0.25)";
  ctx.fillRect(0, height - 3, width * songFrac, 3);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = "rgba(102,252,241,0.04)";
  ctx.lineWidth = 1;
  const step = 44;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawIngredient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ev: HitEvent,
  _settings: Settings
): void {
  const color = INGREDIENT_COLORS[ev.kind === "hold-start" ? 5 : 0] ?? "#66fcf1";
  // Use the beat's ingredient index via the parent beat. We don't have it here
  // directly, so derive a stable color from the event id hash.
  const idx = hashId(ev.id) % INGREDIENT_COLORS.length;
  const fill = INGREDIENT_COLORS[idx];
  const label = INGREDIENT_LABELS[idx];

  // Outer ring.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(7,9,13,0.6)";
  ctx.fill();
  ctx.strokeStyle = fill;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner fill.
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Label.
  ctx.fillStyle = "#0b0c10";
  ctx.font = `bold ${Math.floor(r * 0.9)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 1);

  // Hold indicator: a small downward chevron.
  if (ev.kind === "hold-start") {
    ctx.strokeStyle = "#66fcf1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y + r * 0.55);
    ctx.lineTo(x, y + r * 0.8);
    ctx.lineTo(x + r * 0.4, y + r * 0.55);
    ctx.stroke();
  }
  // Two-step indicator: a small "2x" badge.
  if (ev.id.endsWith("#1")) {
    ctx.fillStyle = "#d6ff3f";
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.fillText("2x", x + r * 0.8, y - r * 0.6);
  }
  void color;
}

function colorForJudgement(j: string): string {
  switch (j) {
    case "perfect": return "#d6ff3f";
    case "great": return "#66fcf1";
    case "good": return "#45a29e";
    case "miss": return "#ff2d55";
    default: return "#c5c6c7";
  }
}

function labelForJudgement(j: string): string {
  switch (j) {
    case "perfect": return "PERFECT";
    case "great": return "GREAT";
    case "good": return "GOOD";
    case "miss": return "MISS";
    default: return "";
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
