// Planet geometry and deterministic event generation.
//
// A planet's angle at game time t (seconds) is:
//   angle(t) = startAngle + omega * t   where omega = 2π / period
//
// A "crossing event" happens whenever angle(t) equals the beat-line angle
// modulo 2π. The beat line is fixed per stage (top of the orbit, -π/2 rad,
// i.e. the 12 o'clock position). Solving for t gives a closed form, so the
// full event list for a stage is reproducible from the planet configs alone
// with no simulation loop and no frame-rate dependence.

import type { PlanetConfig, ScheduledEvent, StageConfig } from "./types";

/** Beat-line angle in radians. -π/2 is the top of the canvas (12 o'clock)
 * because canvas y grows downward. */
export const BEAT_LINE_ANGLE = -Math.PI / 2;

/** Compute a planet's angle at game time t (seconds). */
export function planetAngle(planet: PlanetConfig, t: number): number {
  const omega = (2 * Math.PI) / planet.period;
  return planet.startAngle + omega * t;
}

/** Generate every crossing event for a stage in [0, horizon], sorted by
 * time. Pure and deterministic: same stage config -> same events.
 *
 * For challenge stages the horizon is the stage duration. For sandbox
 * (duration 0, unlimited play) the caller passes an explicit horizon so
 * there are upcoming events to schedule and hit; the engine never finishes
 * a sandbox stage. */
export function generateEvents(stage: StageConfig, horizonSec?: number): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const horizon = horizonSec ?? stage.duration;
  const beat = BEAT_LINE_ANGLE;
  const twoPi = 2 * Math.PI;

  for (const p of stage.planets) {
    const omega = (2 * Math.PI) / p.period;
    if (omega === 0) continue;
    // angle(t) = startAngle + omega * t = beat + 2π * k
    // t = (beat - startAngle + 2π * k) / omega
    // Find the smallest integer k such that t >= 0, then walk forward.
    // Solve (beat - startAngle) / omega + (2π/omega) * k >= 0
    //   => k >= -(beat - startAngle) / (2π) = (startAngle - beat) / (2π)
    const kStart = Math.ceil((p.startAngle - beat) / twoPi);
    let k = kStart;
    let guard = 0;
    while (guard < 100000) {
      const t = (beat - p.startAngle + twoPi * k) / omega;
      if (t > horizon + 1e-6) break;
      if (t >= -1e-9) {
        events.push({
          time: Math.max(0, t),
          planetId: p.id,
          angle: beat,
        });
      }
      k += 1;
      guard += 1;
    }
  }

  events.sort((a, b) => a.time - b.time || a.planetId - b.planetId);
  return events;
}

/** Normalized position of a planet on screen, given a center and the
 * planet's angle at the current game time. Returns canvas-space x/y. */
export function planetPosition(
  planet: PlanetConfig,
  angle: number,
  centerX: number,
  centerY: number,
): { x: number; y: number } {
  return {
    x: centerX + planet.radius * Math.cos(angle),
    y: centerY + planet.radius * Math.sin(angle),
  };
}
