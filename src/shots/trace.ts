import type { ShotKind, ShotPlan } from './types.ts';

/**
 * A reason why the search of a close shot refuses a camera (design 5.6), in the order of the
 * tests:
 *
 * - `axis`: a camera that turns more than `FILM_GRAMMAR.lineAzimuth` from the audience axis.
 * - `look`: a camera that shows the subject look to the other side than in the master shot.
 * - `jump`: a jump cut after the previous shot.
 * - `repeat`: less than 20° from the camera of the last shot of the same subject.
 * - `head`: a head in the foreground, or the outside point of the subject in the frame.
 * - `near`: a point of an animal body in the frame nearer to the camera than `ANIMAL_FLOOR`.
 * - `beamEdge`: a camera at the start of the move near the surface of the cone of the beam.
 * - `distance`: a camera farther from the stage center than `CLOSE_DISTANCE_SHARE` of the default
 *   distance.
 * - `beamSide`: a camera of the move on the other side of the cone of the beam than the start.
 * - `camera`: a camera near an obstacle, or with no clear line to the target.
 * - `sight`: a camera with no clear line to the head, the hands, or the instrument.
 * - `line`: no clear line to the target between the samples of the move.
 * - `object`: another large object in the foreground.
 * - `face`: the own instrument of a subject player hides its eyes.
 */
export type CameraRefusal =
  | 'axis'
  | 'look'
  | 'jump'
  | 'repeat'
  | 'head'
  | 'near'
  | 'beamEdge'
  | 'distance'
  | 'beamSide'
  | 'camera'
  | 'sight'
  | 'line'
  | 'object'
  | 'face';

/**
 * A refusal that the planner keeps for each camera of a subject, because it does not depend on
 * the cut and its test costs much: the tests of the foreground, the beam, the distance, and the
 * clearance.
 */
export type KeptRefusal = Exclude<CameraRefusal, 'axis' | 'look' | 'jump' | 'repeat'>;

/** A camera that the search of a close shot tested. */
export interface CameraTrace {
  /** The azimuth of the camera at the start of the move, in radians. */
  readonly azimuth: number;
  /** The elevation of the camera, in radians. */
  readonly elevation: number;
  /** The arc of the move, in radians. */
  readonly arc: number;
  /** The reason of the refusal, or `null` for the camera of the shot. */
  readonly refusal: CameraRefusal | null;
  /** True when the refusal is the result of the same test at an earlier cut. */
  readonly kept: boolean;
  /**
   * For a refusal by the distance: the largest share of the default distance over the samples of
   * the move. Else `null`.
   */
  readonly share: number | null;
}

/** One search of a clear camera for a subject in one elevation band (design 5.6). */
export interface SearchTrace {
  /** The subject, such as `solo 3`, `conductor back`, or `conductor close`. */
  readonly subject: string;
  /** The front of the subject, in radians. */
  readonly front: number;
  /** The wanted azimuth of the camera, in radians. */
  readonly wantedAzimuth: number;
  /**
   * The elevation band with the lift of the subject, in radians: the elevation above which the
   * search starts, and its top.
   */
  readonly band: readonly [number, number];
  /** True for a full search: the places between and beyond the steps, and the other arc. */
  readonly full: boolean;
  /**
   * The number of cameras that the search skipped with no test, because they are farther from the
   * front of the subject than its limit.
   */
  outsideFront: number;
  /** The tested cameras, in the order of the search. */
  readonly cameras: CameraTrace[];
}

/** One try of a candidate in one elevation band, or of the conductor that fills the time. */
export interface AttemptTrace {
  /** The index of the band in `KEY_SEARCH.bands`, or `null` for all bands. */
  readonly band: number | null;
  /** The searches of the try: none for a wide or a high shot or for no subject, else one or two. */
  readonly searches: SearchTrace[];
  /** True when the try found a framing. */
  found: boolean;
}

/** The rank of a candidate before its score, highest last (design 5.6). */
export type TierName = 'other' | 'entry' | 'soloist' | 'forced';

/** A candidate of a cut, after the rules of the choice. */
export interface CandidateTrace {
  /** The kind and the subject, such as `solo 3`. */
  readonly id: string;
  /** The kind of the shot. */
  readonly kind: ShotKind;
  /** The score after the rules of variety and the seeded jitter. */
  readonly score: number;
  /** The rank before the score. */
  readonly tier: TierName;
  /** The seats of the subject that enter at the cut. */
  readonly entering: readonly number[];
  /**
   * The tries, in their order. The first pass of a cut tries the lower bands of each candidate,
   * and the second pass tries their higher bands. Thus a candidate after the chosen one has no
   * tries of the second pass, but it can have failed tries of the first pass.
   */
  readonly attempts: AttemptTrace[];
}

/**
 * A rule of the choice that drops a candidate before the scores (design 5.6):
 *
 * - `subject`: rule 1, the kind and the subject of the previous shot.
 * - `group`: rule 2, a section or solo shot of the group of the previous shot.
 * - `wideSpacing`: rule 3, fewer than three other shots since the last wide or high shot.
 * - `wideRoom`: rule 3, no room for the other shots before the last shot.
 * - `conductorSpacing`: rule 3b, fewer than five other shots since the last conductor shot.
 * - `sideSpacing`: rule 3c, fewer than three other shots since the last side view.
 */
export type ChoiceRule =
  | 'subject'
  | 'group'
  | 'wideSpacing'
  | 'wideRoom'
  | 'conductorSpacing'
  | 'sideSpacing';

/** A candidate that a rule of the choice drops before the scores. */
interface DroppedTrace {
  /** The kind and the subject, such as `solo 3`. */
  readonly id: string;
  /** The kind of the shot. */
  readonly kind: ShotKind;
  /** The rule that drops it. */
  readonly rule: ChoiceRule;
}

/**
 * The end of the choice at a cut: a shot of a candidate, the hold of the previous shot, or a
 * conductor or wide shot that fills the time when no candidate fits.
 */
export type CutOutcome = 'candidate' | 'hold' | 'conductor' | 'wide';

/** The choice of the shot at one cut. */
export interface CutTrace {
  /** The cut, in song seconds. */
  readonly cutSec: number;
  /** The candidates that the rules drop, in the order of the list. */
  readonly dropped: DroppedTrace[];
  /** The other candidates, in the order of the search. */
  readonly candidates: CandidateTrace[];
  /**
   * The index in `candidates` of the candidate whose try found the camera of the shot, or `null`
   * when no candidate fits. The second pass gives the higher bands to each candidate after all
   * candidates failed in their first bands, so the order of the tries does not show this index.
   */
  chosen: number | null;
  /** The tries of the conductor that fills the time, when no candidate fits. */
  readonly fill: AttemptTrace[];
  /** The end of the choice. */
  outcome: CutOutcome;
}

/** The range of the cuts of a trace, in song seconds, with both ends. */
export interface TraceRange {
  /** The first cut. */
  readonly fromSec: number;
  /** The last cut. */
  readonly toSec: number;
}

/** The plan of a score with the choice at each cut of a range. `traceShots()` makes it. */
export interface ShotTrace {
  /** The plan, the same as the plan of `prepareShots()`. */
  readonly plan: ShotPlan;
  /** The choice at each cut of the range, in the order of the cuts. */
  readonly cuts: readonly CutTrace[];
}
