import { lastAtOrBefore } from '../pose/blend.ts';
import { findEntries } from './entries.ts';
import { noteLoudness } from '../pose/loudness.ts';
import type { Score } from '../score/types.ts';

/** The values of the music rules of the shots (design 5.6). */
const MUSIC_RULES = {
  /** A seat with players is active in a window when its notes cover this part of it. */
  activeCoverage: 0.3,
  /** Activity is `coverage × (activityBase + loudness)`. */
  activityBase: 0.3,
  /** A tutti: this part of the seats with players is active. */
  tuttiShare: 0.65,
  /** A tutti: the mean loudness of the active seats is at least this value. */
  tuttiLoudness: 0.55,
  /** The top line of a window is read at this step, in seconds. */
  topLineStepSec: 0.25,
  /**
   * A seat carries the lead when it holds the top line in this part of the window, or more. The
   * camera follows the instrument with the melody (S1 of the camera report).
   */
  leadShare: 0.5,
  /**
   * A seat also carries the lead when its loudness is this much above the mean loudness of the
   * other active seats: one loud seat over a quiet accompaniment.
   */
  leadLoudness: 0.15,
  /**
   * The players of a choir seat that sing its top voice in this part of the steps in which the
   * seat sings, or more, are its part of the tune: for example the sopranos.
   */
  partShare: 0.5,
  /**
   * An entry counts only when its seat is active in this time after it: the seat plays a passage.
   * A single note after a rest, such as one stroke of the triangle, is no entry of the camera.
   */
  passageSec: 8,
  /**
   * A section or solo shot ends when its subject rests this many full bars, and at least
   * {@link MUSIC_RULES.subjectRestSec}: a rest as long as the rest before an entry. A shorter rest,
   * after which the subject plays again, keeps the shot.
   */
  subjectRestBars: 2,
  subjectRestSec: 3,
} as const;

/** The notes of one seat, for the windows of the shots. */
interface SeatNotes {
  /** The merged spans of the notes: a start, then an end, for each span. Sorted. */
  readonly spans: Float64Array;
  /** The starts of the notes, sorted. */
  readonly starts: Float64Array;
  /** The end of each note, in the order of `starts`. */
  readonly ends: Float64Array;
  /** The loudness of each note, in the order of `starts` (design 5.3). */
  readonly loudness: Float32Array;
  /** The MIDI key of each note, in the order of `starts`. */
  readonly pitches: Uint8Array;
  /** The number of the player of each note in its seat, in the order of `starts`. */
  readonly players: Uint8Array;
  /** The longest note, in seconds. */
  readonly longestSec: number;
  /**
   * The latest end of the notes up to each note, in the order of `starts`. A scan back from a
   * time stops at the first note whose value is not after the time: no earlier note sounds then.
   */
  readonly latestEnds: Float64Array;
}

/** The music of a score that the shot plan reads (design 5.6). */
export interface ScoreMusic {
  /** One entry for each seat. */
  readonly seats: readonly SeatNotes[];
  /** True for each seat with players. The sound-only seat has none. */
  readonly hasPlayers: readonly boolean[];
  /** The number of seats with players. */
  readonly playerSeats: number;
  /**
   * True for each seat with players and a pitched instrument. The timpani and the percussion do
   * not carry a melody.
   */
  readonly pitched: readonly boolean[];
  /** True for each choir seat with players: the voices, which sing the words. */
  readonly voices: readonly boolean[];
  /** The start of each entry after a long rest that starts a passage (design 5.6), sorted. */
  readonly entryStarts: Float64Array;
  /** The seat of each entry, in the order of `entryStarts`. */
  readonly entrySeats: Int32Array;
  /** The start of the rest before each entry, in the order of `entryStarts`. */
  readonly entryRests: Float64Array;
  /** The times of all conducted beats, sorted. */
  readonly beats: Float64Array;
  /** The times of the downbeats, sorted. The index of a downbeat is its bar. */
  readonly downbeats: Float64Array;
}

/** The music of one window of time (design 5.6). */
export interface WindowMusic {
  /** The part of the window that the merged notes of each seat cover, from 0 to 1. */
  readonly coverage: Float64Array;
  /** The highest loudness of the notes of each seat in the window, from 0 to 1. */
  readonly loudness: Float64Array;
  /** `coverage × (0.3 + loudness)` for each seat with players, else 0. */
  readonly activity: Float64Array;
  /** The sum of the activity of all seats. */
  readonly totalActivity: number;
  /** True for each seat with players and a coverage of at least 0.3. */
  readonly active: readonly boolean[];
  /** The number of active seats. */
  readonly activeCount: number;
  /** The mean loudness of the active seats, or 0 with no active seat. */
  readonly meanLoudness: number;
  /** True if 65% or more of the seats with players are active, with a mean loudness of 0.55. */
  readonly tutti: boolean;
  /**
   * True for each seat that carries the lead (design 5.6): an active, pitched seat that holds the
   * highest note of the pitched seats in half the window or more, or that is 0.15 louder than the
   * mean of the other active seats.
   */
  readonly lead: readonly boolean[];
  /**
   * True for each active choir seat that sings the tune (design 5.6): its top voice has the key
   * of the top line, or that key one or more octaves lower, in half the window or more. The
   * instruments often double the tune of a choir an octave higher.
   */
  readonly tune: readonly boolean[];
  /**
   * The players of each choir seat that sings the tune who sing its top voice, by their number
   * in the seat, or `null`.
   */
  readonly tunePlayers: readonly (readonly number[] | null)[];
}

/**
 * Merges the spans of sorted notes.
 *
 * @param starts The starts, sorted.
 * @param ends The ends, in the order of the starts.
 * @returns A start, then an end, for each merged span.
 */
function mergeSpans(starts: Float64Array, ends: Float64Array): Float64Array {
  const out: number[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i] ?? 0;
    const end = ends[i] ?? 0;
    const last = out.length - 1;
    if (last > 0 && start <= (out[last] ?? 0)) {
      out[last] = Math.max(out[last] ?? 0, end);
    } else {
      out.push(start, end);
    }
  }
  return Float64Array.from(out);
}

/**
 * Prepares the music of a score for the windows of the shots: the notes and the merged spans of
 * each seat, the entries, and the beats.
 *
 * @param score The score.
 * @returns The music.
 */
export function prepareMusic(score: Score): ScoreMusic {
  const loudness = noteLoudness(score);
  const bySeat = score.seats.map((): number[] => []);
  for (const [i, note] of score.notes.entries()) {
    bySeat[note.seatIndex]?.push(i);
  }
  const seats = bySeat.map((indices): SeatNotes => {
    // Plain loops: a typed array from a map function was the slowest part of the shot plan.
    const n = indices.length;
    const starts = new Float64Array(n);
    const ends = new Float64Array(n);
    const loud = new Float32Array(n);
    const pitches = new Uint8Array(n);
    const players = new Uint8Array(n);
    const latestEnds = new Float64Array(n);
    let longestSec = 0;
    for (let k = 0; k < n; k++) {
      const i = indices[k] ?? 0;
      const note = score.notes[i];
      starts[k] = note?.startSec ?? 0;
      ends[k] = note?.endSec ?? 0;
      loud[k] = loudness[i] ?? 0;
      pitches[k] = note?.pitch ?? 0;
      players[k] = note?.player ?? 0;
      longestSec = Math.max(longestSec, (ends[k] ?? 0) - (starts[k] ?? 0));
      latestEnds[k] = Math.max(latestEnds[k - 1] ?? 0, ends[k] ?? 0);
    }
    return {
      spans: mergeSpans(starts, ends),
      starts,
      ends,
      loudness: loud,
      pitches,
      players,
      longestSec,
      latestEnds,
    };
  });
  const hasPlayers = score.seats.map((seat) => seat.playerCount > 0);
  const passage = MUSIC_RULES.passageSec;
  const entries = findEntries(
    score.beats,
    score.notes,
    score.seats.length,
    (seat) => hasPlayers[seat] ?? false,
  ).filter((entry) => {
    const spans = seats[entry.seatIndex]?.spans;
    return (
      spans !== undefined &&
      coverageOf(spans, entry.start, entry.start + passage) >= MUSIC_RULES.activeCoverage
    );
  });
  return {
    seats,
    hasPlayers,
    playerSeats: hasPlayers.filter(Boolean).length,
    pitched: score.seats.map(
      (seat, i) =>
        (hasPlayers[i] ?? false) && seat.section !== 'timpani' && seat.section !== 'percussion',
    ),
    voices: score.seats.map((seat, i) => (hasPlayers[i] ?? false) && seat.section === 'choir'),
    entryStarts: Float64Array.from(entries, (e) => e.start),
    entrySeats: Int32Array.from(entries, (e) => e.seatIndex),
    entryRests: Float64Array.from(entries, (e) => e.restFrom),
    beats: Float64Array.from(score.beats, (b) => b.timeSec),
    downbeats: Float64Array.from(
      score.beats.filter((b) => b.indexInBar === 0),
      (b) => b.timeSec,
    ),
  };
}

/**
 * Calculates the part of a window that the merged spans of a seat cover.
 *
 * @param spans The merged spans: a start, then an end, for each span.
 * @param from The start of the window.
 * @param to The end of the window, after `from`.
 * @returns The covered part, from 0 to 1.
 */
function coverageOf(spans: Float64Array, from: number, to: number): number {
  // The spans are sorted and apart, so their ends are sorted too. Find the first end after `from`.
  let low = 0;
  let high = spans.length / 2;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((spans[mid * 2 + 1] ?? 0) <= from) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  let covered = 0;
  for (let k = low; k < spans.length / 2; k++) {
    const start = spans[k * 2] ?? 0;
    if (start >= to) {
      break;
    }
    covered += Math.min(to, spans[k * 2 + 1] ?? 0) - Math.max(from, start);
  }
  return covered / (to - from);
}

/**
 * Finds the highest loudness of the notes of a seat that sound in a window.
 *
 * @param seat The notes of the seat.
 * @param from The start of the window.
 * @param to The end of the window.
 * @returns The loudness, or 0 with no note in the window.
 */
function loudnessIn(seat: SeatNotes, from: number, to: number): number {
  let loudest = 0;
  for (let k = lastAtOrBefore(seat.starts, to - 1e-9); k >= 0; k--) {
    const start = seat.starts[k] ?? 0;
    if (start < from - seat.longestSec || (seat.latestEnds[k] ?? 0) <= from) {
      break;
    }
    if ((seat.ends[k] ?? 0) > from) {
      loudest = Math.max(loudest, seat.loudness[k] ?? 0);
    }
  }
  return loudest;
}

/**
 * Finds the highest key that a seat sounds at a time.
 *
 * @param seat The notes of the seat.
 * @param time The time, in song seconds.
 * @returns The key, or -1 with no note at the time.
 */
function highestAt(seat: SeatNotes, time: number): number {
  let highest = -1;
  for (let k = lastAtOrBefore(seat.starts, time); k >= 0; k--) {
    if ((seat.starts[k] ?? 0) < time - seat.longestSec || (seat.latestEnds[k] ?? 0) <= time) {
      break;
    }
    if ((seat.ends[k] ?? 0) > time) {
      highest = Math.max(highest, seat.pitches[k] ?? -1);
    }
  }
  return highest;
}

/**
 * Counts the players of a seat that sound a key at a time.
 *
 * @param seat The notes of the seat.
 * @param time The time, in song seconds.
 * @param key The key.
 * @param counts The count of each player, which the function adds to.
 */
function countPlayersAt(
  seat: SeatNotes,
  time: number,
  key: number,
  counts: Map<number, number>,
): void {
  for (let k = lastAtOrBefore(seat.starts, time); k >= 0; k--) {
    if ((seat.starts[k] ?? 0) < time - seat.longestSec || (seat.latestEnds[k] ?? 0) <= time) {
      break;
    }
    if ((seat.ends[k] ?? 0) > time && seat.pitches[k] === key) {
      const player = seat.players[k] ?? 0;
      counts.set(player, (counts.get(player) ?? 0) + 1);
    }
  }
}

/** The top line of a window, read every 0.25 s. */
interface TopLine {
  /** The part of the window in which each seat holds the top line. */
  readonly held: Float64Array;
  /**
   * The part of the window in which the top voice of each choir seat has the key of the top
   * line, or that key one or more octaves lower.
   */
  readonly tune: Float64Array;
  /** The number of steps in which each choir seat sings. */
  readonly sung: Float64Array;
  /**
   * For each choir seat, the number of steps in which each player sings the top voice of the
   * seat, by its number in the seat. `null` for the other seats.
   */
  readonly singers: readonly (Map<number, number> | null)[];
}

/**
 * Reads the top line of a window: the highest key of the pitched seats. The window is read every
 * 0.25 s. A tie gives the step to each seat of the tie. A choir seat also counts the steps in
 * which its top voice sings the top line in octaves, and the players of that voice.
 *
 * @param music The music of the score.
 * @param from The start of the window.
 * @param to The end of the window.
 * @returns The top line of the window.
 */
function topLineOf(music: ScoreMusic, from: number, to: number): TopLine {
  const count = music.seats.length;
  const held = new Float64Array(count);
  const tune = new Float64Array(count);
  const sung = new Float64Array(count);
  const singers = music.voices.map((voice) => (voice ? new Map<number, number>() : null));
  const step = MUSIC_RULES.topLineStepSec;
  const steps = Math.max(1, Math.round((to - from) / step));
  const keys = new Int16Array(count);

  for (let n = 0; n < steps; n++) {
    const time = from + (n + 0.5) * ((to - from) / steps);
    let top = -1;
    for (const [i, seat] of music.seats.entries()) {
      const key = music.pitched[i] ? highestAt(seat, time) : -1;
      keys[i] = key;
      top = Math.max(top, key);
    }
    if (top < 0) {
      continue;
    }
    for (let i = 0; i < count; i++) {
      const key = keys[i] ?? -1;
      if (key === top) {
        held[i] = (held[i] ?? 0) + 1 / steps;
      }
      const voice = singers[i];
      const seat = music.seats[i];
      if (!voice || !seat || key < 0) {
        continue;
      }
      sung[i] = (sung[i] ?? 0) + 1;
      if ((top - key) % 12 === 0) {
        tune[i] = (tune[i] ?? 0) + 1 / steps;
      }
      countPlayersAt(seat, time, key, voice);
    }
  }

  return { held, tune, sung, singers };
}

/**
 * Reads the music of a window (design 5.6): the coverage, the loudness, and the activity of each
 * seat, and the tutti rule.
 *
 * @param music The music of the score.
 * @param from The start of the window, in song seconds.
 * @param to The end of the window, after `from`.
 * @returns The music of the window.
 */
export function musicIn(music: ScoreMusic, from: number, to: number): WindowMusic {
  const r = MUSIC_RULES;
  const count = music.seats.length;
  const coverage = new Float64Array(count);
  const loudness = new Float64Array(count);
  const activity = new Float64Array(count);
  const active: boolean[] = [];
  let totalActivity = 0;
  let activeCount = 0;
  let loudnessSum = 0;
  for (const [i, seat] of music.seats.entries()) {
    const players = music.hasPlayers[i] ?? false;
    const c = coverageOf(seat.spans, from, to);
    const l = loudnessIn(seat, from, to);
    coverage[i] = c;
    loudness[i] = l;
    const a = players ? c * (r.activityBase + l) : 0;
    activity[i] = a;
    totalActivity += a;
    const isActive = players && c >= r.activeCoverage;
    active.push(isActive);
    if (isActive) {
      activeCount++;
      loudnessSum += l;
    }
  }
  const meanLoudness = activeCount > 0 ? loudnessSum / activeCount : 0;

  const line = topLineOf(music, from, to);
  const tune = music.seats.map(
    (_, i) => (active[i] ?? false) && (line.tune[i] ?? 0) >= r.leadShare,
  );
  const tunePlayers = line.singers.map((counts, i) => {
    if (!counts || !tune[i]) {
      return null;
    }
    const least = r.partShare * (line.sung[i] ?? 0);
    return [...counts.entries()]
      .filter(([, steps]) => steps >= least)
      .map(([player]) => player)
      .toSorted((a, b) => a - b);
  });
  const lead = music.seats.map((_, i) => {
    if (!active[i] || !music.pitched[i]) {
      return false;
    }
    const others = activeCount - 1;
    const othersMean = others > 0 ? (loudnessSum - (loudness[i] ?? 0)) / others : 0;
    return (
      (line.held[i] ?? 0) >= r.leadShare ||
      (tune[i] ?? false) ||
      (others > 0 && (loudness[i] ?? 0) - othersMean >= r.leadLoudness)
    );
  });

  return {
    coverage,
    loudness,
    activity,
    totalActivity,
    active,
    activeCount,
    meanLoudness,
    tutti:
      music.playerSeats > 0 &&
      activeCount >= r.tuttiShare * music.playerSeats &&
      meanLoudness >= r.tuttiLoudness,
    lead,
    tune,
    tunePlayers,
  };
}

/**
 * Finds the seats with an entry in a time range (design 5.6).
 *
 * @param music The music of the score.
 * @param from The start of the range, in song seconds.
 * @param to The end of the range, in song seconds. The range holds both ends.
 * @returns The seats, in the order of the entries.
 */
export function entriesIn(music: ScoreMusic, from: number, to: number): number[] {
  const seats: number[] = [];
  for (let k = lastAtOrBefore(music.entryStarts, to); k >= 0; k--) {
    if ((music.entryStarts[k] ?? 0) < from) {
      break;
    }
    seats.push(music.entrySeats[k] ?? -1);
  }
  return seats.toReversed();
}

/**
 * Finds the seats that rest at a time and enter later in a time range (design 5.6): an entry in
 * the range whose rest starts at the time or before it.
 *
 * @param music The music of the score.
 * @param time The time of the rest, in song seconds.
 * @param from The start of the range of the entries, in song seconds.
 * @param to The end of the range, in song seconds. The range holds both ends.
 * @returns The seats, in the order of the entries.
 */
export function restingIn(music: ScoreMusic, time: number, from: number, to: number): number[] {
  const seats: number[] = [];
  for (let k = lastAtOrBefore(music.entryStarts, to); k >= 0; k--) {
    if ((music.entryStarts[k] ?? 0) < from) {
      break;
    }
    if ((music.entryRests[k] ?? Infinity) <= time) {
      seats.push(music.entrySeats[k] ?? -1);
    }
  }
  return seats.toReversed();
}

/**
 * Finds the first rest of the subject of a shot (design 5.6): a time from which none of its seats
 * plays for at least two bars and 3 s. The rule reads past the end of the range, so a subject that
 * plays again within that time does not rest.
 *
 * @param music The music of the score.
 * @param seats The seats of the subject.
 * @param from The start of the range, in song seconds. A subject silent at it rests from it.
 * @param to The end of the range, in song seconds: the latest start of the rest.
 * @returns The start of the rest, or `null` with no such rest in the range.
 */
export function subjectRestIn(
  music: ScoreMusic,
  seats: readonly number[],
  from: number,
  to: number,
): number | null {
  const spans: [number, number][] = [];
  for (const seat of seats) {
    const merged = music.seats[seat]?.spans;
    if (!merged) {
      continue;
    }
    for (let k = 0; k < merged.length; k += 2) {
      const end = merged[k + 1] ?? 0;
      if (end > from) {
        spans.push([merged[k] ?? 0, end]);
      }
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const restOf = (time: number): number =>
    Math.max(MUSIC_RULES.subjectRestSec, MUSIC_RULES.subjectRestBars * barLengthAt(music, time));
  let sounding = from;
  for (const [start, end] of spans) {
    if (sounding > to + 1e-9) {
      return null;
    }
    if (start - sounding >= restOf(sounding) - 1e-9) {
      return sounding;
    }
    sounding = Math.max(sounding, end);
  }
  return sounding <= to + 1e-9 ? sounding : null;
}

/**
 * Gives the length of the bar at a time: from its downbeat to the next downbeat.
 *
 * @param music The music of the score.
 * @param time The time, in song seconds.
 * @returns The bar length in seconds, or 2 s with fewer than two downbeats.
 */
export function barLengthAt(music: ScoreMusic, time: number): number {
  const { downbeats } = music;
  const i = Math.max(0, Math.min(lastAtOrBefore(downbeats, time), downbeats.length - 2));
  const start = downbeats[i];
  const next = downbeats[i + 1];
  return start !== undefined && next !== undefined ? next - start : 2;
}

/**
 * Gives the length of the beat at a time: from its beat to the next beat.
 *
 * @param music The music of the score.
 * @param time The time, in song seconds.
 * @returns The beat length in seconds, or 0.5 s with fewer than two beats.
 */
export function beatLengthAt(music: ScoreMusic, time: number): number {
  const { beats } = music;
  const i = Math.max(0, Math.min(lastAtOrBefore(beats, time + 1e-6), beats.length - 2));
  const start = beats[i];
  const next = beats[i + 1];
  return start !== undefined && next !== undefined ? next - start : 0.5;
}
