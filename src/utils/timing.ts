// Timing utilities.
//
// GameClock wraps an AudioContext into a pause-aware, zero-based game clock.
// Game time starts at 0 when the clock is created, advances with the audio
// context, and freezes while paused. All event times and input judgements
// are expressed in this clock's seconds so pause/resume cannot corrupt
// timing.
//
// The raw AudioContext.currentTime is the only monotonic clock we trust.
// We never derive timing from Date.now(), performance.now() for judging, or
// CSS animation progress.

export class GameClock {
  private readonly getAudioTime: () => number;
  private readonly originAudioTime: number;
  private pausedDuration = 0;
  private pauseStart: number | null = null;

  constructor(getAudioTime: () => number) {
    this.getAudioTime = getAudioTime;
    this.originAudioTime = getAudioTime();
  }

  /** Current game time in seconds, zero-based, pause-adjusted. */
  now(): number {
    const raw = this.getAudioTime() - this.originAudioTime;
    if (this.pauseStart !== null) {
      // While paused, freeze game time at the moment pause began.
      return this.pauseStart - this.originAudioTime - this.pausedDuration;
    }
    return raw - this.pausedDuration;
  }

  pause(): void {
    if (this.pauseStart !== null) return;
    this.pauseStart = this.getAudioTime();
  }

  resume(): void {
    if (this.pauseStart === null) return;
    this.pausedDuration += this.getAudioTime() - this.pauseStart;
    this.pauseStart = null;
  }

  isPaused(): boolean {
    return this.pauseStart !== null;
  }

  /** Total seconds spent paused so far (for diagnostics / tests). */
  pausedFor(): number {
    return this.pausedDuration;
  }

  /** Convert a game-time seconds value back to an absolute AudioContext
   * currentTime value, so the audio layer can schedule a note at a future
   * game time. Only valid while not paused. */
  gameTimeToAudioTime(gameTime: number): number {
    return gameTime + this.originAudioTime + this.pausedDuration;
  }

  /** Convert an absolute AudioContext.currentTime value (e.g. captured at
   * the moment of a keypress) into game-time seconds so it can be compared
   * against scheduled event times. Only valid while not paused. */
  audioTimeToGameTime(audioTime: number): number {
    return audioTime - this.originAudioTime - this.pausedDuration;
  }
}
