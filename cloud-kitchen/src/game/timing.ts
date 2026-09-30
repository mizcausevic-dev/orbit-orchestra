// Timing helpers. Pure functions, no DOM, no AudioContext. Fully testable.
//
// The game uses AudioContext.currentTime as the monotonic clock. All beat times
// are stored relative to the song start (audio clock seconds). When the song
// starts, we record songStartAudioTime = audioContext.currentTime + leadIn.
// The "song position" at any moment is audioContext.currentTime - songStartAudioTime.
//
// Player input is judged against the beat time, with a user-adjustable latency
// offset subtracted from the input time:
//
//   delta = inputAudioTime - latencyOffset - (songStartAudioTime + beat.time)
//
// A positive delta means the player hit late; negative means early.

export const PERFECT_WINDOW = 0.05; // 50 ms
export const GREAT_WINDOW = 0.1; // 100 ms
export const GOOD_WINDOW = 0.15; // 150 ms
export const MISS_WINDOW = 0.2; // 200 ms — anything outside is a miss

/** Convert a beat time (song-relative seconds) into an absolute audio clock time. */
export function beatToAudioTime(
  beatTime: number,
  songStartAudioTime: number
): number {
  return songStartAudioTime + beatTime;
}

/** Convert an absolute audio clock time into a song position in seconds. */
export function audioTimeToSongPosition(
  audioTime: number,
  songStartAudioTime: number
): number {
  return audioTime - songStartAudioTime;
}

/**
 * Compute the signed timing delta in seconds between a player input and a beat.
 * Positive = late, negative = early. Applies the user latency offset.
 */
export function timingDelta(
  inputAudioTime: number,
  beatTime: number,
  songStartAudioTime: number,
  latencyOffset: number
): number {
  const target = beatToAudioTime(beatTime, songStartAudioTime);
  return inputAudioTime - latencyOffset - target;
}

/** Absolute error in seconds, after latency correction. */
export function absError(
  inputAudioTime: number,
  beatTime: number,
  songStartAudioTime: number,
  latencyOffset: number
): number {
  return Math.abs(
    timingDelta(inputAudioTime, beatTime, songStartAudioTime, latencyOffset)
  );
}

/** Seconds per beat at a given BPM. */
export function secondsPerBeat(bpm: number): number {
  if (bpm <= 0) throw new Error(`bpm must be positive, got ${bpm}`);
  return 60 / bpm;
}

/** Quantize a song position to the nearest beat index. */
export function nearestBeatIndex(
  songPosition: number,
  bpm: number
): number {
  return Math.round(songPosition / secondsPerBeat(bpm));
}
