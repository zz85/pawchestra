import { insideBeam } from '../models/beam.ts';
import { ModelCache } from '../models/model-cache.ts';
import type { SceneLayout } from '../models/layout.ts';
import type { Vec3 } from '../models/tuples.ts';
import { lastAtOrBefore } from '../pose/blend.ts';
import { mixHash, mulberry32 } from '../pose/random.ts';
import { smoothstep } from '../pose/rest.ts';
import { runAll } from '../score/steps.ts';
import type { Steps } from '../score/steps.ts';
import type { Score } from '../score/types.ts';
import { FREE_BEAM_FADE } from './beam-opacity.ts';
import { angleDifference, keyDistance, viewAngle, writeKeyPosition } from './camera-keys.ts';
import {
  CLEARANCE,
  bodyBoxes,
  cameraClear,
  nearClearance,
  prepareClearance,
  prepareSightLines,
  segmentClear,
  segmentCrossesBox,
  sightsClear,
  targetLineClear,
} from './clearance.ts';
import type { ClearBox, Segment, StageClearance, SubjectSightLines } from './clearance.ts';
import type { StageBody } from './foreground.ts';
import {
  ANIMAL_FLOOR,
  animalTooNear,
  foregroundHead,
  foregroundObject,
  inFrame,
  lensScale,
} from './foreground.ts';
import {
  FILM_GRAMMAR,
  azimuthFrom,
  highestInFrame,
  keepsLine,
  lookSide,
  motionOf,
  thirdOf,
  writeLookPoint,
} from './grammar.ts';
import type { Motion } from './grammar.ts';
import { FRAME_MARGINS, SHOT_SIZES, frameHalfHeight } from './shot-size.ts';
import type { ShotSize } from './shot-size.ts';
import {
  barLengthAt,
  beatLengthAt,
  entriesIn,
  musicIn,
  prepareMusic,
  restingIn,
  subjectRestIn,
} from './music.ts';
import type { ScoreMusic, WindowMusic } from './music.ts';
import {
  SUBJECT_SIZES,
  activeMiddle,
  conductorBackSubject,
  conductorCloseSubject,
  prepareBodies,
  prepareSubjects,
  sectionSubject,
  sideOf,
  sideSubject,
  soloSubject,
} from './subjects.ts';
import type { SectionGroup, StageSide, StageSubjects, Subject, SubjectFace } from './subjects.ts';
import type {
  AttemptTrace,
  CameraRefusal,
  CandidateTrace,
  ChoiceRule,
  CutTrace,
  KeptRefusal,
  SearchTrace,
  ShotTrace,
  TierName,
  TraceRange,
} from './trace.ts';
import { isCloseShot } from './types.ts';
import type { Composition, Shot, ShotKey, ShotKind, ShotPlan } from './types.ts';
import {
  CINEMA_ASPECT,
  DEFAULT_AZIMUTH,
  DEFAULT_ELEVATION,
  DEFAULT_TARGET,
  FIELD_OF_VIEW,
  defaultDistance,
  defaultView,
  landscapeZoom,
} from './view.ts';

/** Degrees to radians. */
const DEG = Math.PI / 180;

/**
 * The seed of the shot plan of the app. A fixed seed gives each demo the same film on each visit
 * (design 5.6). The screenshot script uses it too.
 */
export const SHOT_SEED = 1;

/** The times of the shots, in song seconds (design 5.6). */
export const SHOT_TIMES = {
  /** The shortest shot. */
  minSec: 4,
  /** The longest conductor, section, or solo shot. */
  maxSec: 14,
  /** The longest wide or high shot. */
  maxWideSec: 18,
  /** The range of the seeded wanted length of a conductor, section, or solo shot. */
  closeWanted: [5, 12],
  /** The range of the seeded wanted length of a wide or high shot. */
  wideWanted: [9, 12],
  /** A cut loses 1 for each this many seconds between its length and the wanted length. */
  lengthScale: 3,
  /** The last shot starts on the last downbeat at least this long before the song end. */
  lastLeadSec: 8,
  /**
   * A wide or high shot needs this many other shots since the last wide or high shot, or since
   * the start. Thus the wide and high shots after the opening are at most 25% of the shots after
   * it.
   */
  wideSpacing: 3,
  /**
   * The time that each missing shot of rule 3 needs before the last shot. With the shortest
   * wanted length of a close shot then (6.5 s), the slow last bars of the Beethoven 8 demo left
   * room for two shots only, when no subject fitted at the last cuts.
   */
  roomSec: 9.5,
  /** The choice of a subject reads the music of this window after the cut. */
  choiceWindowSec: 8,
  /** A section or solo shot whose subject rests ends at most this many bars after the rest starts. */
  restHoldBars: 1,
  /**
   * The longest time with no wide or high shot, from the end of one to the start of the next.
   * With no limit, K. 315 shows no wide view from 10 s to 183 s.
   */
  maxWideGapSec: 60,
  /** After this time with no wide or high shot, the wide and high candidates get a bonus. */
  wideDueSec: 45,
  /**
   * A conductor shot needs this many other shots since the last conductor shot, or since the
   * start. Thus the conductor shots are at most 17% of the shots. The Bach demo had 12 of 35.
   */
  conductorSpacing: 5,
  /** A side view needs this many other shots since the last side view, or since the start. */
  sideSpacing: 3,
} as const;

/** The bonus of a downbeat as a cut point (design 5.6). */
const CUT_BONUS = {
  /** A bar index that is a multiple of 4: a phrase line. */
  phrase: 0.5,
  /** A bar index that is a multiple of 2. */
  halfPhrase: 0.2,
  /**
   * A cut at an entry (design 5.6): from a quarter of a bar before it to one bar after it. It is
   * larger than the phrase bonus and the penalty of a repeated length together, so a cut at an
   * entry wins over a cut near it with no entry.
   */
  entry: 5,
  /** A cut at an entry loses this much for each bar after the start of the entry. */
  entryDelay: 0.5,
  /**
   * The beat in the middle of a bar with an even number of beats. Cuts only on downbeats give Bach
   * 30 of 34 shots of 9.6 s, and K. 525 three lengths.
   */
  midBar: -0.3,
  /**
   * A shot with the length of the previous shot. With a steady tempo, the cuts of the Bach demo
   * fell on whole bars of 2.4 s, and 4 lengths made 37 shots. The penalty is larger than the
   * phrase bonus, so a phrase line does not make a grid, and smaller than the entry bonus. With
   * -0.4, 68 of 180 plans (6 demos, 30 seeds) had more than 15% equal neighbor lengths.
   */
  sameLength: -1.0,
} as const;

/**
 * The reach of an entry (design 5.6), in bars: a cut from a quarter of a bar before the entry to
 * one bar after it is a cut at the entry.
 */
const ENTRY_REACH = { before: 0.25, after: 1 } as const;

/** The weights of the choice of the next shot (design 5.6). */
const CHOICE_WEIGHTS = {
  wide: 0.8,
  wideTutti: 2.2,
  high: 0.3,
  highTutti: 1.6,
  /** For a high shot with 6 or more active seats. */
  highBusy: 0.4,
  conductor: 1.1,
  /** For a conductor shot with 5 or more active seats. */
  conductorBusy: 0.5,
  side: 0.4,
  /** For the share of the activity of the seats of the side. */
  sideShare: 2,
  /** For a side view with a seat that enters at the cut. */
  sideEntry: 0.8,
  /** For a side view with the piano, which view 03 of `scene.png` shows. */
  sidePiano: 0.6,
  section: 0.6,
  sectionShare: 3,
  sectionEntry: 1.5,
  sectionTutti: -0.8,
  /** For a section shot of a group with a seat that carries the lead. */
  sectionLead: 0.6,
  solo: 0.2,
  soloShare: 2.5,
  /** For a solo shot with 3 or fewer active seats, or at an entry of any seat. */
  soloExposed: 1.2,
  soloEntry: 1.2,
  /**
   * For a solo shot of a seat that carries the lead: the top line, or one loud seat over a quiet
   * accompaniment. The flute of the K. 315 concerto had its first solo shot at 94 s.
   */
  soloLead: 1.2,
  /** For a solo shot of the piano or the harp. */
  soloFeature: 0.4,
  soloTutti: -1.0,
  /** For a subject in the last 4 shots. */
  recent: -1.6,
  /** For each earlier use of a section or solo subject. */
  reuse: -0.5,
  /** The seeded jitter goes from -0.25 to 0.25. */
  jitter: 0.5,
  /**
   * For a wide or high shot after 45 s with no wide view. It is larger than the score of each
   * close candidate, so that a wide view comes at least every 60 s.
   */
  wideDue: 8,
} as const;

/** The blend rule of design 5.6. */
const BLEND_RULES = {
  /** A beat of this length or longer is slow music. */
  slowBeatSec: 0.75,
  /** A mean loudness of this value or less is soft music. */
  softLoudness: 0.35,
  /** The shortest and the longest blend. A blend lasts one beat. */
  minSec: 0.5,
  maxSec: 1.2,
  /** The two cameras are less than this many stage sides apart. */
  nearInSides: 0.35,
} as const;

/**
 * The height of the cameras of the shots (design 5.6): the wanted camera of each kind stands at
 * this part of the height above the stage top that its nominal elevation gives, at the same
 * distance and azimuth. The elevations of `SHOT_KEYS` and `WIDE_VARIANTS` are nominal. A low
 * camera films the players near the height of their eyes, as the cameras on the railings of a
 * concert hall do. A lower camera sees more heads in the foreground, so more close shots rise.
 */
export const CAMERA_LOWER = 0.7;

/**
 * Gives the elevation of a camera at {@link CAMERA_LOWER} of the height of a nominal elevation
 * above the stage top (design 5.6).
 *
 * @param target The target of the key.
 * @param distance The distance from the camera to the target, in meters.
 * @param nominal The nominal elevation, in radians.
 * @returns The elevation of the lower camera, in radians.
 */
function lowered(target: Vec3, distance: number, nominal: number): number {
  const height = target[1] + distance * Math.sin(nominal);
  const sine = (CAMERA_LOWER * height - target[1]) / distance;
  return Math.asin(Math.min(1, Math.max(-1, sine)));
}

/**
 * Gives the distance of the camera of a wide or a high shot from its target, at the aspect of
 * Cinematic mode.
 *
 * @param stageSide The stage side `S`.
 * @param wide True for a wide shot, which takes the landscape rule of `cameraAt()`.
 * @param zoom The zoom of the key.
 * @returns The distance, in meters.
 */
function farDistance(stageSide: number, wide: boolean, zoom: number): number {
  const landscape = wide ? landscapeZoom(CINEMA_ASPECT) : 1;
  return defaultDistance(stageSide, CINEMA_ASPECT) * landscape * zoom;
}

/**
 * The search of a clear camera (design 5.6): the wanted azimuth, then these steps to each side,
 * then the same azimuths higher.
 */
const KEY_SEARCH = {
  azimuthSteps: [0, 12, 24, 36, 48, 60, 72].map((d) => d * DEG),
  /**
   * The steps of the full search of an entry, after the steps above: each place of the grid, up
   * to 150° from the wanted azimuth. Thus the search reaches each place within 75° of the front
   * from each wanted azimuth. The single horn of a test file behind the strings had one clear
   * camera of about 45 at its entry. A move of the players by 1 cm took it away.
   */
  fullSteps: Array.from({ length: 26 }, (...[, i]) => i * 6 * DEG),
  /**
   * The seeded offset of the wanted azimuth from the front is a multiple of this angle, in
   * degrees. Thus each camera of the search of a subject is on one grid around its front, and the
   * planner keeps the result of the tests of each camera for the later cuts.
   */
  azimuthGrid: 6,
  /** The rises of the search above the wanted elevation. */
  elevationSteps: [0, 8, 16, 24, 32, 40].map((d) => d * DEG),
  /** The camera stays within this angle of the front of the subject. */
  maxFromFront: 75 * DEG,
  /**
   * The camera of a side view stays within this angle of the front of its side, so that it shows
   * the side from the front, as views 03 and 04 of `scene.png`.
   */
  sideFromFront: 30 * DEG,
  /**
   * The camera of a side view stays at or below this elevation: the top of the first band of
   * {@link KEY_SEARCH}.bands. Views 03 and 04 of `scene.png` film the side low. Side views from
   * 34° to 44° looked down on the side, with the heads of the front rows over it.
   */
  sideCeiling: 24 * DEG,
  /**
   * The camera of a section or solo shot stays at least this far in azimuth from the camera of the
   * last shot of the same subject. With no limit, K. 315 shows the solo flute six times from
   * almost the same angle.
   */
  repeatAngle: 20 * DEG,
  /**
   * The tops of the elevation bands of the search above the low band, plus the lift of a piano
   * shot. At a cut, each candidate first gets a search in the low band, at the wanted elevation
   * with each azimuth of the grid, then in the first band, and only then in the higher bands.
   * Most close cameras that rise stop at the first top, so it sets the height of the close shots.
   * Close shots of the back rows from 40° to 60° show the tops of the heads, and the dark area
   * beside the stage fills 30% to 45% of the frame.
   */
  bands: [24, 34, 44].map((d) => d * DEG),
  /**
   * A candidate with a score this near to the best score of the cut gets the second band before
   * the candidates with lower scores get it. Thus an entry or the lead keeps its shot.
   */
  bandMargin: 1,
} as const;

/** The samples of a move that the planner tests, as parts of the move. */
const MOVE_SAMPLES = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * The tests of the tops of the heads with the composed camera of a close frame (design 5.6). Each
 * test that finds a head above the top margin grows the frame, so that the head comes down to it.
 */
const HEAD_TEST_PASSES = 2;

/**
 * The samples between the samples of a move at which the planner also tests the line of sight
 * to the target: with the samples of the move, 1/16 of the move apart. A section camera of the
 * K. 525 demo crossed a box at 15/16 of its move, between two of the five samples.
 */
const LINE_SAMPLES = Array.from({ length: 17 }, (...[, i]) => i / 16).filter(
  (...[, i]) => i % 4 !== 0,
);

/**
 * The samples of a move at which the planner tests the distance floor of the animals, 1/16 of the
 * move apart. A body at a corner of the frame came into it between two of the five samples.
 */
const NEAR_SAMPLES = Array.from({ length: 17 }, (...[, i]) => i / 16);

/**
 * The index in {@link NEAR_SAMPLES} of each sample of {@link MOVE_SAMPLES}. The tests of a move
 * share the camera of each sample ({@link MoveCameras}).
 */
const MOVE_INDICES = MOVE_SAMPLES.map((u) => NEAR_SAMPLES.indexOf(u));

/** The index in {@link NEAR_SAMPLES} of each sample of {@link LINE_SAMPLES}. */
const LINE_INDICES = LINE_SAMPLES.map((u) => NEAR_SAMPLES.indexOf(u));

/** The samples of a move at which the planner tests the sight lines of the subject. */
const SIGHT_MOVE_SAMPLES = new Set<number>([0, 0.5, 1]);

/** The samples of the line of sight along a blend: 1/64 of the move apart. */
const SIGHT_SAMPLES = Array.from({ length: 65 }, (...[, i]) => i / 64);

/** The smallest distance of a camera from the surface of the cone of the beam, in meters. */
const BEAM_MARGIN = 0.3;

/**
 * A close camera stays nearer to the stage center than this part of the default distance. Free
 * mode fades the beam from 0.45 on (4.5), so a change to Free mode keeps the beam of the shot.
 */
export const CLOSE_DISTANCE_SHARE = FREE_BEAM_FADE[0] - 0.01;

/**
 * Tells on which side of the cone of the visible beam a camera is (design 4.5, 5.6).
 *
 * @param stageSide The stage side `S`.
 * @param point The camera.
 * @returns `inside` or `outside` with a margin of {@link BEAM_MARGIN}, else `edge`.
 */
function beamSide(stageSide: number, point: Vec3): 'inside' | 'outside' | 'edge' {
  if (insideBeam(stageSide, point, BEAM_MARGIN)) {
    return 'inside';
  }
  return insideBeam(stageSide, point, -BEAM_MARGIN) ? 'edge' : 'outside';
}

/**
 * Mixes two points.
 *
 * @param a The point at 0.
 * @param b The point at 1.
 * @param t The weight of `b`.
 * @returns The mixed point.
 */
function mixPoints(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** One of the four wide shots: the azimuth and the elevation in degrees, and the zoom. */
interface WideVariant {
  readonly azimuth: number;
  readonly elevation: number;
  readonly zoom: number;
}

/**
 * The wide shots (design 5.6). The first one is the default view of design 4.5. The elevations are
 * nominal ({@link CAMERA_LOWER}). The zoom is a factor of the default view, and it keeps each
 * player in the frame of a landscape view.
 */
export const WIDE_VARIANTS: readonly WideVariant[] = [
  { azimuth: DEFAULT_AZIMUTH / DEG, elevation: DEFAULT_ELEVATION / DEG, zoom: 1 },
  { azimuth: -24, elevation: 21, zoom: 1.1 },
  { azimuth: 24, elevation: 21, zoom: 1.1 },
  { azimuth: 0, elevation: 17, zoom: 1 },
];

/** The default view as a wide variant. */
const DEFAULT_WIDE: WideVariant = {
  azimuth: DEFAULT_AZIMUTH / DEG,
  elevation: DEFAULT_ELEVATION / DEG,
  zoom: 1,
};

/**
 * Gives the key of the default view of design 4.5 at a zoom.
 *
 * @param zoom The zoom of the key: 1 for the default view.
 * @returns The key.
 */
function defaultKey(zoom: number): ShotKey {
  return { azimuth: DEFAULT_AZIMUTH, elevation: DEFAULT_ELEVATION, zoom, fov: FIELD_OF_VIEW };
}

/**
 * The aspect from which the landscape rule of design 4.5 holds its zoom: a desktop of 1440 × 900.
 * The wide views fit the stage into the free area of such a view.
 */
const DESKTOP_ASPECT = 1.6;

/**
 * The vertical field of view of the wide and high shots, in degrees (design 5.6): at
 * `CINEMA_ASPECT`, it shows the horizontal angle that {@link FIELD_OF_VIEW} shows at
 * {@link DESKTOP_ASPECT}. Thus the stage fills a 21:9 frame as it fills the free area of a desktop
 * view. At 30°, the low wide shots showed the stage in less than half of the width, over a band of
 * the dark floor.
 */
export const WIDE_FOV =
  (2 * Math.atan((Math.tan((FIELD_OF_VIEW / 2) * DEG) * DESKTOP_ASPECT) / CINEMA_ASPECT)) / DEG;

/**
 * The camera values of each kind of shot, in degrees and factors (design 5.6). The elevations are
 * nominal: the camera stands lower ({@link CAMERA_LOWER}).
 */
const SHOT_KEYS = {
  /**
   * The push-in keeps the wide camera farther than 0.5 of the default distance, the end of the
   * beam fade of Free mode (design 4.5).
   */
  wide: { fov: WIDE_FOV, pushIn: 0.92, arc: 6 },
  /**
   * View 09 of `scene.png`: the stage from the front and high in the hall, farther than the
   * default view.
   */
  high: { fov: WIDE_FOV, zoom: 0.75, azimuth: [0, 12], elevation: [37, 41], arc: 8, rise: 4 },
  /** View 05 of `scene.png`: the conductor from behind, close. */
  conductor: { fov: 26, offset: [6, 18], elevation: 8, pushIn: 0.92 },
  /** View 02 of `scene.png`: the orchestra over the shoulder of the bear, from the audience side. */
  conductorBack: { fov: 30, offset: [0, 8], elevation: 19, pushIn: 0.95 },
  /** Views 03 and 04 of `scene.png`: one side of the stage, from the front of that side and low. */
  side: { fov: 30, offset: [0, 12], elevation: 11, pushIn: 0.95, arc: 6 },
  /**
   * The section and the solo shots look down more than the side views: the wedges of the strings
   * and the rows of the winds stand close, and a low camera showed the subject behind the heads
   * and the instruments of its neighbors.
   */
  section: { fov: 30, offset: [8, 22], elevation: 17, backRise: 8, pushIn: 0.92, arc: 6 },
  solo: { fov: 24, offset: [20, 40], elevation: 18, backRise: 10, pushIn: 0.9, arc: 4 },
} as const;

/**
 * The shots of a small group (design 5.6): a score with fewer than this many seats with players
 * gets only the solo shots of its players, a two-shot of all players, and the wide shots.
 */
export const SMALL_GROUP_SEATS = 3;

/** A candidate for the next shot. */
interface Candidate {
  /** The kind of the shot. */
  readonly kind: ShotKind;
  /** The kind and the subject, for example `solo 3`. */
  readonly id: string;
  /** The group of a section or solo shot, else `null`. */
  readonly group: SectionGroup | null;
  /** The side of the stage of a side view, else `null`. */
  readonly side: StageSide | null;
  /**
   * The seats of a section shot or of a side view, with the most activity first, or the seat of
   * a solo shot.
   */
  readonly seats: readonly number[];
  /** The players of a choir part by their number in the seat, or `null` for all players. */
  readonly part: readonly number[] | null;
  /** The score of the choice, after the rules of the choice. */
  readonly score: number;
  /** The seats of the subject that enter at the cut. */
  readonly entering: readonly number[];
  /**
   * The rank of the candidate before its score (design 5.6): a wide view that cannot wait, then a
   * soloist that enters at the cut, then a subject that enters at the cut, then the other
   * candidates.
   */
  readonly tier: Tier;
}

/** The ranks of the candidates before their scores, highest first (design 5.6). */
const TIERS = { other: 0, entry: 1, soloist: 2, forced: 3 } as const;

/** The rank of a candidate before its score. */
type Tier = (typeof TIERS)[keyof typeof TIERS];

/** The name of each rank of a candidate, for a trace. */
const TIER_NAMES: Readonly<Record<Tier, TierName>> = {
  [TIERS.other]: 'other',
  [TIERS.entry]: 'entry',
  [TIERS.soloist]: 'soloist',
  [TIERS.forced]: 'forced',
};

/** A shot of the plan, with the data of the choice of the next shot. */
interface PlannedShot {
  readonly shot: Shot;
  readonly id: string;
  readonly group: SectionGroup | null;
  /** The size of the frame of its last key ({@link frameSize}), for the jump cut rule. */
  readonly size: number;
  /** The move of the shot, which the move of the next shot does not reverse. */
  readonly motion: Motion;
  /** The boxes that hold the target. */
  readonly held: ReadonlySet<ClearBox>;
}

/** The data of the planner of one score. */
interface Planner {
  readonly music: ScoreMusic;
  readonly subjects: StageSubjects;
  /** The body of each animal, for the distance floor of a close shot. */
  readonly bodies: readonly StageBody[];
  readonly clearance: StageClearance;
  readonly stageSide: number;
  /** The camera of the master shot: the default view at the aspect of Cinematic mode. */
  readonly master: Vec3;
  /** The seed of the plan. */
  readonly seed: number;
  /** The cut of the shot that the planner chooses now, in song seconds. */
  cut: number;
  /** The start of the last shot, in song seconds. */
  readonly lastStart: number;
  readonly planned: PlannedShot[];
  /** The body boxes and the sight lines of each subject so far, by its target and its owner. */
  readonly sightCache: Map<string, SubjectLines>;
  /**
   * The result of the foreground and the clearance tests of each close move so far: one map for
   * each subject and move, by the place of the camera on the grid. The same subject comes back at
   * many cuts, with the same cameras.
   */
  readonly moveCache: Map<string, Map<number, boolean>>;
  /**
   * The half height of the frame of each close move so far, by the keys of
   * {@link Planner.moveCache}. The fit of a frame reads each point of the subject in three passes.
   */
  readonly frameCache: Map<string, Map<number, number>>;
  /**
   * The result of the line test of each close move so far ({@link lineRefusal}), by the keys of
   * {@link Planner.moveCache}. The test does not depend on the cut, and a third of the cameras
   * came back with the same result.
   */
  readonly lineCache: Map<string, Map<number, 'axis' | 'look' | null>>;
  /** The number of shots since the last wide or high shot, or since the start. */
  sinceWide: number;
  /** The end of the last wide or high shot, in song seconds. */
  lastWideEnd: number;
  /** The seats with players on the stage. Fewer than 3 make a small group. */
  readonly staged: readonly number[];
  /** The number of shots since the last conductor shot, or since the start. */
  sinceConductor: number;
  /** The number of conductor shots so far. */
  conductorShots: number;
  /** The number of shots since the last side view, or since the start. */
  sinceSide: number;
  /**
   * The azimuth of the last shot of each side, section, or solo subject, by the subject of the
   * rule of no repeat of a framing.
   */
  readonly lastAzimuth: Map<string, number>;
  /**
   * The elevation band of the search of a close camera at this cut: the elevation above which it
   * starts, and its top, in radians.
   */
  band: [number, number];
  /**
   * True in the low band: the search tries only the wanted elevation of the shot, with a full
   * search of the azimuths.
   */
  lowBand: boolean;
  /**
   * True when the search of a close camera is full: for a candidate that shows a seat that enters
   * at the cut. A full search also tries the places between the steps, the places beyond them, and
   * the arc to the other side. The low band always searches in full.
   */
  fullSearch: boolean;
  /** The trace of the choice, or `null` for a plan with no trace. */
  readonly trace: TraceSink | null;
}

/** The result of a kept test of a camera that refuses it, for a trace. */
interface KeptResult {
  /** The refusal. */
  readonly refusal: KeptRefusal;
  /** The largest share of the default distance for a refusal by the distance, else `null`. */
  readonly share: number | null;
}

/** The trace that the planner writes during a plan (`traceShots()`). */
interface TraceSink {
  /** The range of the traced cuts. */
  readonly range: TraceRange;
  /** The traced cuts, in their order. */
  readonly cuts: CutTrace[];
  /**
   * The refusal of each camera that failed a kept test at any cut, also outside the range: one map
   * for each map of `Planner.moveCache`, by the same key of the camera. A camera that failed before
   * fails again with no test, and its trace takes the old refusal.
   */
  readonly kept: Map<string, Map<number, KeptResult>>;
  /** The cut that the planner traces now, or `null` outside the range. */
  cut: CutTrace | null;
  /** The try that the planner traces now, or `null`. */
  attempt: AttemptTrace | null;
}

/** The keys and the subject of a new shot, before its times. */
interface Framing {
  /** The point that the camera looks at. */
  readonly target: Vec3;
  /** Half the height of the frame at the target, or 0 for a wide or a high shot. */
  readonly halfHeight: number;
  /** The camera at the start of the move. */
  readonly from: ShotKey;
  /** The camera at the end of the move. */
  readonly to: ShotKey;
  /** The seats of the subject. */
  readonly seats: readonly number[];
  /** The players of a choir part, or `null` for all players. */
  readonly part: readonly number[] | null;
  /** The boxes of the body of the subject. */
  readonly held: ReadonlySet<ClearBox>;
  /** The place of the subject in the frame, or `null` for the target in the middle. */
  readonly composition: Composition | null;
}

/**
 * Makes the seeded generator of one decision of the plan (design 5.6): a framing, a jitter, or an
 * end. The seed, the time, and the name of the decision set its numbers, so the numbers do not
 * depend on the other decisions. With one generator for the full plan, each camera search took
 * numbers from it. When the search of one candidate changed, all later shots changed. A move of
 * the players by 1 to 2 cm then changed 30 of 31 shots of the Boulanger demo.
 *
 * @param seed The seed of the plan.
 * @param time The time of the decision, in song seconds: the cut, or the start of the shot.
 * @param name The name of the decision, for example `jitter solo 3`.
 * @returns The generator.
 */
function decisionRandom(seed: number, time: number, name: string): () => number {
  let hash = mixHash(seed, Math.round(time * 1000));
  for (let i = 0; i < name.length; i++) {
    hash = mixHash(hash, name.charCodeAt(i));
  }
  return mulberry32(hash);
}

/**
 * Gives a seeded number in a range.
 *
 * @param random The seeded generator.
 * @param range The lowest and the highest value.
 * @returns A number in the range.
 */
function between(random: () => number, range: readonly [number, number]): number {
  return range[0] + (range[1] - range[0]) * random();
}

/**
 * Rounds an angle to the azimuth grid of the search (design 5.6).
 *
 * @param degrees The angle, in degrees.
 * @returns The nearest multiple of 6°, in radians.
 */
function onGrid(degrees: number): number {
  const grid = KEY_SEARCH.azimuthGrid;
  return Math.round(degrees / grid) * grid * DEG;
}

/**
 * Gives a seeded sign.
 *
 * @param random The seeded generator.
 * @returns 1 or -1.
 */
function signOf(random: () => number): number {
  return random() < 0.5 ? -1 : 1;
}

/**
 * Mixes two keys.
 *
 * @param a The key at 0.
 * @param b The key at 1.
 * @param u The part of the move, from 0 to 1.
 * @returns The mixed key.
 */
function mixKeys(a: ShotKey, b: ShotKey, u: number): ShotKey {
  return {
    azimuth: a.azimuth + (b.azimuth - a.azimuth) * u,
    elevation: a.elevation + (b.elevation - a.elevation) * u,
    zoom: a.zoom + (b.zoom - a.zoom) * u,
    fov: a.fov + (b.fov - a.fov) * u,
  };
}

/**
 * Calculates the camera position of a key.
 *
 * @param stageSide The stage side `S`.
 * @param target The target.
 * @param halfHeight Half the height of the frame at the target, or 0 for a wide or a high shot.
 * @param key The key.
 * @param aspect The aspect of the view.
 * @returns The position.
 */
export function keyPosition(
  stageSide: number,
  target: Vec3,
  halfHeight: number,
  key: ShotKey,
  aspect: number,
): Vec3 {
  const out: [number, number, number] = [0, 0, 0];
  const distance = keyDistance(stageSide, halfHeight, key, aspect);
  writeKeyPosition(target, key.azimuth, key.elevation, distance, out);
  return out;
}

/** A refusal of the tests of the camera of a move. */
type MoveRefusal = Extract<
  KeptRefusal,
  'beamEdge' | 'distance' | 'beamSide' | 'camera' | 'sight' | 'line' | 'face'
>;

/**
 * The share of the subject players whose own instrument may hide their eyes in a close shot
 * (design 5.6): none, at each sample of the move. A quarter of a section let the bell of the tuba
 * cover the face of the rhino in a side view of the brass.
 */
const HIDDEN_FACES = 0;

/** The distance from the eyes at which the line of the face test starts, in meters. */
const FACE_START = 0.03;

/**
 * Counts the subject players whose own instrument hides their eyes from a camera: the line from
 * the eyes to the camera crosses a box of the instrument (design 5.6).
 *
 * @param faces The faces of the subject players.
 * @param camera The camera.
 * @returns The count.
 */
function hiddenFaces(faces: readonly SubjectFace[], camera: Vec3): number {
  let hidden = 0;
  for (const { eyes, shield } of faces) {
    const length = Math.hypot(camera[0] - eyes[0], camera[1] - eyes[1], camera[2] - eyes[2]);
    const k = length > 0 ? FACE_START / length : 0;
    const segment = {
      ax: eyes[0] + (camera[0] - eyes[0]) * k,
      ay: eyes[1] + (camera[1] - eyes[1]) * k,
      az: eyes[2] + (camera[2] - eyes[2]) * k,
      bx: camera[0],
      by: camera[1],
      bz: camera[2],
    };
    if (shield.some((box) => segmentCrossesBox(box, segment))) {
      hidden++;
    }
  }
  return hidden;
}

/**
 * Tests if a move keeps its camera clear (design 5.6) at the samples of the move, at the aspect of
 * Cinematic mode. The camera also stays inside or outside the cone of the visible beam for the
 * full move, because the beam draws only its outer faces, and it stays nearer to the stage center
 * than 0.44 of the default distance.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @param held The boxes of the body of the subject.
 * @param sights The lines of sight to the head, the hands, and the instrument of a solo or a
 *   conductor shot, or `null`. Each camera of the move sees them (design 5.6).
 * @returns `null` if the move is clear, else the first test that fails: the beam at the start,
 *   the distance, the side of the beam, the camera, the sight lines, or the line to the target.
 */
function moveRefusal(
  planner: Planner,
  move: MoveCameras,
  held: ReadonlySet<ClearBox>,
  sights: SubjectSightLines | null,
): MoveRefusal | null {
  const S = planner.stageSide;
  const aspect = CINEMA_ASPECT;
  const { target } = move.subject;
  // A camera that crosses the cone of the beam in a shot sees the beam come or go at once. The
  // camera stays on one side for the full move, with a margin.
  const side = beamSide(S, sampleCamera(planner, move, 0));
  if (side === 'edge') {
    return 'beamEdge';
  }
  // The cheap tests of all samples come first, so that a camera that fails them costs little.
  const cameras = MOVE_INDICES.map((i) => sampleCamera(planner, move, i));
  for (const camera of cameras) {
    const share = Math.hypot(camera[0], camera[1], camera[2]) / defaultDistance(S, aspect);
    if (share > CLOSE_DISTANCE_SHARE) {
      return 'distance';
    }
    if (beamSide(S, camera) !== side) {
      return 'beamSide';
    }
  }
  // Each segment of the tests below lies in the box of the target, the sight points, and the
  // cameras of the move, so the tests read only the obstacles near that box.
  const clearance = nearClearance(planner.clearance, [
    target,
    ...(sights ? [sights.head.point, ...sights.parts.map((line) => line.point)] : []),
    ...NEAR_SAMPLES.map((...[, i]) => sampleCamera(planner, move, i)),
  ]);
  for (let k = 0; k < cameras.length; k++) {
    const camera = cameras[k] ?? target;
    if (!cameraClear(clearance, target, camera, camera, held)) {
      return 'camera';
    }
    if (
      sights &&
      SIGHT_MOVE_SAMPLES.has(MOVE_SAMPLES[k] ?? -1) &&
      !sightsClear(clearance, sights, camera)
    ) {
      return 'sight';
    }
    const { faces } = move.subject;
    if (hiddenFaces(faces, camera) > Math.floor(faces.length * HIDDEN_FACES)) {
      return 'face';
    }
  }
  for (const i of LINE_INDICES) {
    const camera = sampleCamera(planner, move, i);
    if (!targetLineClear(clearance, target, camera, held)) {
      return 'line';
    }
  }
  return null;
}

/**
 * Gives the largest share of the default distance of the cameras of a move, over the samples of
 * the move. A close camera stays at or below {@link CLOSE_DISTANCE_SHARE}. Only a trace reads it.
 *
 * @param stageSide The stage side `S`.
 * @param target The target.
 * @param halfHeight Half the height of the frame at the target.
 * @param from The key at the start.
 * @param to The key at the end.
 * @returns The largest share.
 */
function moveShare(
  stageSide: number,
  target: Vec3,
  halfHeight: number,
  from: ShotKey,
  to: ShotKey,
): number {
  let largest = 0;
  for (const u of MOVE_SAMPLES) {
    const camera = keyPosition(stageSide, target, halfHeight, mixKeys(from, to, u), CINEMA_ASPECT);
    const share =
      Math.hypot(camera[0], camera[1], camera[2]) / defaultDistance(stageSide, CINEMA_ASPECT);
    largest = Math.max(largest, share);
  }
  return largest;
}

/**
 * Gives the size of the frame of a key for the jump cut rule (design 5.6): half the height of the
 * frame at the distance of the target, at the aspect of Cinematic mode.
 *
 * @param stageSide The stage side `S`.
 * @param wide True for a wide shot, which takes the landscape rule of `cameraAt()`.
 * @param halfHeight Half the height of the frame at the target, or 0 for a wide or a high shot.
 * @param key The key.
 * @returns The size, in meters.
 */
function frameSize(stageSide: number, wide: boolean, halfHeight: number, key: ShotKey): number {
  const landscape = wide ? landscapeZoom(CINEMA_ASPECT) : 1;
  const distance = keyDistance(stageSide, halfHeight, key, CINEMA_ASPECT) * landscape;
  return distance * Math.tan((key.fov / 2) * DEG);
}

/**
 * Tells if a new shot is a jump cut after the previous shot (design 5.6): the view turns less
 * than 30°, and the size of the frame changes less than 1.5 times. The planner tests it after
 * each shot, also of another subject, so the 30° rule holds for each shot of the same subject.
 *
 * @param previous The previous shot.
 * @param from The first key of the new shot.
 * @param size The size of the frame of the new shot ({@link frameSize}).
 * @returns True for a jump cut.
 */
function jumpCut(previous: PlannedShot | undefined, from: ShotKey, size: number): boolean {
  if (!previous) {
    return false;
  }
  const ratio = Math.max(size, previous.size) / Math.max(1e-6, Math.min(size, previous.size));
  const rules = FILM_GRAMMAR;
  return viewAngle(previous.shot.to, from) < rules.jumpAngle && ratio < rules.jumpSize;
}

/** The move of a close shot. */
interface CloseMove {
  readonly wantedAzimuth: number;
  readonly elevation: number;
  /**
   * The arc of the move, in radians. When the end leaves the front range, its sign turns, or the
   * arc is 0 when the move of the previous shot fixes its direction.
   */
  readonly arc: number;
  /** The move of the previous shot to the right: -1, 0 for none, or 1. */
  readonly lateral: number;
  readonly pushIn: number;
  readonly fov: number;
  /** The azimuth of the last shot of the same subject, or `null`. */
  readonly avoid: number | null;
  /** The camera stays within this angle of the front of the subject, in radians. */
  readonly maxFromFront: number;
  /** The shot size, which sets the frame of each camera. */
  readonly size: ShotSize;
  /** The highest elevation of the camera, in radians: `Infinity` for no limit but the bands. */
  readonly ceiling: number;
}

/** The body boxes and the sight lines of a subject. */
interface SubjectLines {
  readonly held: ReadonlySet<ClearBox>;
  readonly sights: SubjectSightLines | null;
}

/**
 * Gives the key of a subject for the caches of the planner: its target and the owner of its
 * sight points.
 *
 * @param subject The subject.
 * @returns The key.
 */
function subjectKey(subject: Subject): string {
  return `${subject.target.join()} ${subject.sights?.owner ?? 'none'}`;
}

/**
 * Gives the body boxes and the sight lines of a subject. The planner keeps them for each subject,
 * because the same subject comes back at many cuts.
 *
 * @param planner The planner.
 * @param subject The subject.
 * @returns The body boxes and the sight lines.
 */
function subjectLines(planner: Planner, subject: Subject): SubjectLines {
  const key = subjectKey(subject);
  const known = planner.sightCache.get(key);
  if (known) {
    return known;
  }
  const held = bodyBoxes(planner.clearance, subject.target);
  const sights = subject.sights ? prepareSightLines(planner.clearance, subject.sights, held) : null;
  const lines = { held, sights };
  planner.sightCache.set(key, lines);
  return lines;
}

/** A camera of a close key, with the point that it looks at for the composition of the shot. */
interface ComposedCamera {
  readonly camera: Vec3;
  readonly look: Vec3;
  /** The place of the target in the frame, in the units of the view. */
  readonly middle: readonly [number, number];
}

/**
 * Gives the camera of a close key and the point that it looks at (design 5.6).
 *
 * @param planner The planner.
 * @param subject The subject.
 * @param halfHeight Half the height of the frame at the target.
 * @param composition The place of the subject in the frame, or `null`.
 * @param key The key.
 * @returns The camera.
 */
function composedCamera(
  planner: Planner,
  subject: Subject,
  halfHeight: number,
  composition: Composition | null,
  key: ShotKey,
): ComposedCamera {
  const camera = keyPosition(planner.stageSide, subject.target, halfHeight, key, CINEMA_ASPECT);
  return composeAt(subject, camera, composition, key.fov);
}

/**
 * Gives the point that a close camera looks at for the composition of its shot (design 5.6).
 *
 * @param subject The subject.
 * @param camera The camera.
 * @param composition The place of the subject in the frame, or `null`.
 * @param fov The vertical field of view, in degrees.
 * @returns The camera.
 */
function composeAt(
  subject: Subject,
  camera: Vec3,
  composition: Composition | null,
  fov: number,
): ComposedCamera {
  const look: [number, number, number] = [0, 0, 0];
  const y = writeLookPoint(camera, subject.target, composition, fov, CINEMA_ASPECT, look);
  const third = composition?.third ?? 0;
  return { camera, look, middle: [third * FILM_GRAMMAR.thirdLine, y] };
}

/**
 * The cameras of a close move, which its tests share (design 5.6). The tests read the same cameras
 * of the samples of {@link NEAR_SAMPLES} and of the two end keys, and a composed camera needs the
 * correction of its look point. So each camera comes at its first use, and the other tests read
 * it.
 */
interface MoveCameras {
  /** The subject of the move. */
  readonly subject: Subject;
  /** Half the height of the frame at the target. */
  readonly halfHeight: number;
  /** The key at the start, which is also the key of the first sample. */
  readonly from: ShotKey;
  /** The key at the end. The last sample mixes the keys, so it can differ by a rounding. */
  readonly to: ShotKey;
  /** The key of each sample of {@link NEAR_SAMPLES}: `from`, then the mixed keys. */
  readonly keys: readonly ShotKey[];
  /** The camera of each sample, after its first use. */
  readonly cameras: (Vec3 | undefined)[];
}

/** The cameras of a close move with the composition of its shot. */
interface ComposedMove extends MoveCameras {
  /** The place of the subject in the frame, or `null`. */
  readonly composition: Composition | null;
  /** The composed camera of each sample, after its first use. */
  readonly composed: (ComposedCamera | undefined)[];
  /** The composed cameras of `from` and `to`, after their first use. */
  readonly ends: MoveEnds;
}

/** The composed cameras of the end keys of a close move, after their first use. */
interface MoveEnds {
  /** The composed camera of `from`. */
  from?: ComposedCamera;
  /** The composed camera of `to`. */
  to?: ComposedCamera;
}

/**
 * Starts the cameras of a close move ({@link MoveCameras}).
 *
 * @param subject The subject.
 * @param halfHeight Half the height of the frame at the target.
 * @param from The key at the start.
 * @param to The key at the end.
 * @returns The cameras, with none calculated.
 */
function moveCameras(
  subject: Subject,
  halfHeight: number,
  from: ShotKey,
  to: ShotKey,
): MoveCameras {
  const keys = NEAR_SAMPLES.map((u, i) => (i === 0 ? from : mixKeys(from, to, u)));
  return { subject, halfHeight, from, to, keys, cameras: [] };
}

/**
 * Gives the camera of a sample of a close move.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @param i The index of the sample in {@link NEAR_SAMPLES}.
 * @returns The camera.
 */
function sampleCamera(planner: Planner, move: MoveCameras, i: number): Vec3 {
  const known = move.cameras[i];
  if (known) {
    return known;
  }
  const key = move.keys[i] ?? move.from;
  const camera = keyPosition(
    planner.stageSide,
    move.subject.target,
    move.halfHeight,
    key,
    CINEMA_ASPECT,
  );
  move.cameras[i] = camera;
  return camera;
}

/**
 * Gives the composed camera of a sample of a close move.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @param i The index of the sample in {@link NEAR_SAMPLES}.
 * @returns The camera and its look point.
 */
function sampleComposed(planner: Planner, move: ComposedMove, i: number): ComposedCamera {
  const known = move.composed[i];
  if (known) {
    return known;
  }
  const fov = (move.keys[i] ?? move.from).fov;
  const composed = composeAt(move.subject, sampleCamera(planner, move, i), move.composition, fov);
  move.composed[i] = composed;
  return composed;
}

/**
 * Gives the composed camera of an end key of a close move.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @param end The end.
 * @returns The camera and its look point.
 */
function endComposed(planner: Planner, move: ComposedMove, end: 'from' | 'to'): ComposedCamera {
  if (end === 'from') {
    move.ends.from ??= sampleComposed(planner, move, 0);
    return move.ends.from;
  }
  move.ends.to ??= composedCamera(
    planner,
    move.subject,
    move.halfHeight,
    move.composition,
    move.to,
  );
  return move.ends.to;
}

/**
 * Gives the place of a subject in the frame of a close move (design 5.6): its eyes on the upper
 * third line, and the target on the third line away from its look in the middle of the move.
 *
 * @param subject The subject.
 * @param middle The camera in the middle of the move.
 * @returns The composition, or `null` for a subject in the middle of the frame.
 */
function compositionAt(subject: Subject, middle: () => Vec3): Composition | null {
  if (!subject.eyes) {
    return null;
  }
  const third = thirdOf(subject.facing, azimuthFrom(middle(), subject.center));
  return { eyes: subject.eyes, third };
}

/**
 * Adds the composition to the cameras of a close move ({@link compositionAt}).
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @returns The cameras with the composition.
 */
function composeMove(planner: Planner, move: MoveCameras): ComposedMove {
  const middle = NEAR_SAMPLES.indexOf(0.5);
  const composition = compositionAt(move.subject, () => sampleCamera(planner, move, middle));
  return { ...move, composition, composed: [], ends: {} };
}

/**
 * Tells if a head or another object stands in the foreground of a close move, at its start or at
 * its end, in the frame of its composition at the aspect of Cinematic mode (design 5.6).
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @param test The test of one camera: the heads, or the cover of the other objects.
 * @returns True if a head or an object stands in the foreground.
 */
function moveForeground(planner: Planner, move: ComposedMove, test: 'heads' | 'objects'): boolean {
  const { members, focus, outside, floor } = move.subject;
  const aspect = CINEMA_ASPECT;
  if (test === 'heads' && outside) {
    // The point stays out of the frame for the full move.
    for (const i of MOVE_INDICES) {
      const fov = (move.keys[i] ?? move.from).fov;
      const { camera, look } = sampleComposed(planner, move, i);
      if (inFrame(outside, camera, look, fov, aspect)) {
        return true;
      }
    }
  }
  for (const end of ['from', 'to'] as const) {
    const key = move[end];
    const { camera, look, middle } = endComposed(planner, move, end);
    // The depth of field of the frame blurs a near head or box at a side edge: a dirty frame.
    const lens = lensScale(camera, look, key.fov, planner.stageSide);
    const found =
      test === 'heads'
        ? foregroundHead(
            planner.subjects.heads,
            members,
            focus,
            camera,
            look,
            key.fov,
            aspect,
            floor,
            middle,
            lens,
          )
        : foregroundObject(planner.clearance, members, focus, camera, look, key.fov, aspect, lens);
    if (found) {
      return true;
    }
  }
  return false;
}

/**
 * Gives the bodies near the cameras of a path, each with only its near parts. A body or a part
 * whose sphere stays farther than `ANIMAL_FLOOR` from a sphere around the cameras is far from
 * each camera of the path, so its points need no test.
 *
 * @param planner The planner.
 * @param cameras The cameras of the path. There is at least one.
 * @returns The near bodies.
 */
function nearBodies(planner: Planner, cameras: readonly Vec3[]): StageBody[] {
  const first = cameras[0] ?? [0, 0, 0];
  const middle = mixPoints(first, cameras.at(-1) ?? first, 0.5);
  const path = Math.max(
    ...cameras.map((c) => Math.hypot(c[0] - middle[0], c[1] - middle[1], c[2] - middle[2])),
  );
  const nearMiddle = (center: Vec3, radius: number): boolean => {
    const dx = center[0] - middle[0];
    const dy = center[1] - middle[1];
    const dz = center[2] - middle[2];
    return dx * dx + dy * dy + dz * dz < (ANIMAL_FLOOR + radius + path) ** 2;
  };
  const near: StageBody[] = [];
  for (const body of planner.bodies) {
    const parts = nearMiddle(body.center, body.radius)
      ? body.parts.filter((part) => nearMiddle(part.center, part.radius))
      : [];
    if (parts.length > 0) {
      near.push({ ...body, parts });
    }
  }
  return near;
}

/**
 * Tells if an animal in the frame of a close move comes nearer to the camera than
 * `ANIMAL_FLOOR`, at each of {@link NEAR_SAMPLES}, in the frame of its composition (design 5.6).
 * Only the bodies near the path of the camera need the test of each sample.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @returns True if an animal is too near.
 */
function moveNear(planner: Planner, move: ComposedMove): boolean {
  const cameras = NEAR_SAMPLES.map((...[, i]) => sampleCamera(planner, move, i));
  const near = nearBodies(planner, cameras);
  if (near.length === 0) {
    return false;
  }
  for (const [i, key] of move.keys.entries()) {
    const { camera, look } = sampleComposed(planner, move, i);
    if (animalTooNear(near, camera, look, key.fov, CINEMA_ASPECT)) {
      return true;
    }
  }
  return false;
}

/** The keys and the frame of the shot after a blend, for the floor test of the blend. */
type BlendShot = Pick<Shot, 'target' | 'halfHeight' | 'composition' | 'from' | 'to'>;

/**
 * Tells if an animal in the frame of a blend comes nearer to the camera than `ANIMAL_FLOOR`, at
 * each of {@link NEAR_SAMPLES} of the blend (design 5.6). The samples follow `cameraAt()`: the
 * camera, the point that it looks at, and the field of view go from the end of the previous shot
 * to the camera of the next shot, which moves too. Thus the path is not a move of one shot, and
 * the tests of the two moves do not cover it.
 *
 * @param planner The planner.
 * @param previous The previous shot.
 * @param next The shot after the blend.
 * @param blendSec The time of the blend, in seconds.
 * @param spanSec The time of the move of the next shot, in seconds.
 * @returns True if an animal is too near.
 */
function blendNear(
  planner: Planner,
  previous: Shot,
  next: BlendShot,
  blendSec: number,
  spanSec: number,
): boolean {
  const S = planner.stageSide;
  const aspect = CINEMA_ASPECT;
  const end = mixKeys(previous.from, previous.to, 1);
  const start = keyPosition(S, previous.target, previous.halfHeight, end, aspect);
  const startLook: [number, number, number] = [0, 0, 0];
  writeLookPoint(start, previous.target, previous.composition, end.fov, aspect, startLook);
  const frames = NEAR_SAMPLES.map((s) => {
    const key = mixKeys(next.from, next.to, spanSec > 0 ? smoothstep((s * blendSec) / spanSec) : 0);
    const camera = keyPosition(S, next.target, next.halfHeight, key, aspect);
    const look: [number, number, number] = [0, 0, 0];
    writeLookPoint(camera, next.target, next.composition, key.fov, aspect, look);
    const w = smoothstep(s);
    return {
      camera: mixPoints(start, camera, w),
      look: mixPoints(startLook, look, w),
      fov: end.fov + (key.fov - end.fov) * w,
    };
  });
  const near = nearBodies(
    planner,
    frames.map((f) => f.camera),
  );
  return (
    near.length > 0 && frames.some((f) => animalTooNear(near, f.camera, f.look, f.fov, aspect))
  );
}

/**
 * Runs the tests of a close move that the planner keeps for each camera, because they do not
 * depend on the cut (design 5.6). The cheap tests come first, and the cover of the objects last.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @returns The first test that fails, or `null` for a clear move.
 */
function keptRefusal(planner: Planner, move: ComposedMove): KeptRefusal | null {
  if (moveForeground(planner, move, 'heads')) {
    return 'head';
  }
  const { held, sights } = subjectLines(planner, move.subject);
  const refusal = moveRefusal(planner, move, held, sights);
  if (refusal) {
    return refusal;
  }
  if (moveNear(planner, move)) {
    return 'near';
  }
  return moveForeground(planner, move, 'objects') ? 'object' : null;
}

/**
 * Tests the 180° rule of a close move (design 5.6): each camera of the move keeps the line of the
 * stage, and the subject looks to the same side of the screen as in the master shot, or the look
 * is neutral in one of the two.
 *
 * @param planner The planner.
 * @param move The cameras of the move.
 * @returns `axis` for a camera over the line, `look` for a look to the other side, else `null`.
 */
function lineRefusal(planner: Planner, move: ComposedMove): 'axis' | 'look' | null {
  const { subject } = move;
  const master = lookSide(subject.facing, azimuthFrom(planner.master, subject.center));
  for (const end of ['from', 'to'] as const) {
    const { camera, look } = endComposed(planner, move, end);
    if (!keepsLine(camera, look)) {
      return 'axis';
    }
    const side = lookSide(subject.facing, azimuthFrom(camera, subject.center));
    if (side !== 0 && master !== 0 && side !== master) {
      return 'look';
    }
  }
  return null;
}

/**
 * Gives the sign of the seeded offset of a close camera from the front of its subject (design
 * 5.6): toward the side of the front where the master camera stands, so that the look of the
 * subject keeps its screen direction. A subject with a neutral look in the master shot keeps the
 * seeded sign.
 *
 * @param planner The planner.
 * @param subject The subject.
 * @param seeded The seeded sign, 1 or -1.
 * @returns 1 or -1.
 */
function offsetSign(planner: Planner, subject: Subject, seeded: number): number {
  const master = azimuthFrom(planner.master, subject.center);
  if (lookSide(subject.facing, master) === 0) {
    return seeded;
  }
  return Math.sign(angleDifference(master, subject.facing)) || seeded;
}

/**
 * Searches a clear camera for a close shot (design 5.6) in the elevation band of the cut. The low
 * band tries only the wanted elevation, at {@link CAMERA_LOWER} of the height of its nominal
 * elevation, with a full search. A higher band tries the wanted azimuth, then ±12° to ±72°, then
 * the same azimuths 8° to 40° higher, up to the top of the band. At each elevation, a full search
 * then tries each place of the grid with the arc of the move, and then with the arc to the other
 * side when the move of the previous shot does not fix its direction. The camera stays within 75°
 * of the front of the subject. A camera over the line of the stage or across the look of the
 * subject does not count (the 180° rule). These cameras do not count either: a camera that makes a
 * jump cut, a camera with a head or another large object in the foreground, and a camera nearer
 * than `ANIMAL_FLOOR` to an animal in its frame. In a traced try, each tested camera goes into the
 * trace with its refusal.
 *
 * @param planner The planner.
 * @param subject The subject.
 * @param move The move of the shot.
 * @param name The name of the subject in a trace, such as `solo 3` or `conductor back`.
 * @returns The framing, or `null` with no clear camera.
 */
function searchClose(
  planner: Planner,
  subject: Subject,
  move: CloseMove,
  name: string,
): Framing | null {
  const { held } = subjectLines(planner, subject);
  const moveKey = `${subjectKey(subject)} ${move.size.share} ${subject.reach} ${move.pushIn} ${move.fov}`;
  const known = planner.moveCache.get(moveKey) ?? new Map<number, boolean>();
  planner.moveCache.set(moveKey, known);
  const frames = planner.frameCache.get(moveKey) ?? new Map<number, number>();
  planner.frameCache.set(moveKey, frames);
  const lines = planner.lineCache.get(moveKey) ?? new Map<number, 'axis' | 'look' | null>();
  planner.lineCache.set(moveKey, lines);
  const previous = planner.planned.at(-1);
  const s = KEY_SEARCH;
  // The band moves up with the lift of a piano shot. The wanted elevation is low (CAMERA_LOWER).
  const bottom = planner.band[0] + subject.lift;
  const top = Math.min(planner.band[1], move.ceiling) + subject.lift;
  // The frame of a camera of the move: the subject fills the share of the width of its shot size,
  // with its look room, and the frame holds its height (design 5.6).
  const frameAt = (azimuth: number, elevation: number, arc: number): number => {
    const third = subject.eyes ? thirdOf(subject.facing, azimuth + arc / 2) : 0;
    const at = (a: number): number =>
      frameHalfHeight(subject, move.size, a, elevation, third, move.fov, move.pushIn);
    return Math.max(at(azimuth), at(azimuth + arc));
  };
  // The frame of a camera of the move, tested with the composed camera at the push-in, where the
  // frame is closest: the fit tilts no camera, and a steep camera sees a far head higher.
  const heldFrame = (azimuth: number, elevation: number, arc: number): number => {
    let half = frameAt(azimuth, elevation, arc);
    if (!subject.eyes || subject.tops.length === 0) {
      return half;
    }
    const line = FILM_GRAMMAR.thirdLine;
    const limit = 1 - FRAME_MARGINS.top;
    const from: ShotKey = { azimuth, elevation, zoom: 1, fov: move.fov };
    const to: ShotKey = { azimuth: azimuth + arc, elevation, zoom: move.pushIn, fov: move.fov };
    const middle = mixKeys(from, to, 0.5);
    for (let pass = 0; pass < HEAD_TEST_PASSES; pass++) {
      const composition = compositionAt(subject, () =>
        keyPosition(planner.stageSide, subject.target, half, middle, CINEMA_ASPECT),
      );
      const { camera, look } = composedCamera(planner, subject, half, composition, to);
      const highest = highestInFrame(camera, look, subject.tops, move.fov);
      if (highest <= limit) {
        break;
      }
      half *= (highest - line) / (limit - line);
    }
    return half;
  };
  const fit: ShotKey = { azimuth: 0, elevation: 0, zoom: 1, fov: move.fov };
  const nominal = frameAt(move.wantedAzimuth, move.elevation, 0);
  const distance = keyDistance(planner.stageSide, nominal, fit, CINEMA_ASPECT);
  const wanted = lowered(subject.target, distance, move.elevation);
  const sink = planner.trace;
  const kept = sink ? (sink.kept.get(moveKey) ?? new Map<number, KeptResult>()) : null;
  if (sink && kept) {
    sink.kept.set(moveKey, kept);
  }
  const search: SearchTrace | null = sink?.attempt
    ? {
        subject: name,
        front: subject.front,
        wantedAzimuth: move.wantedAzimuth,
        band: planner.lowBand ? [wanted, wanted] : [bottom, top],
        full: planner.fullSearch || planner.lowBand,
        outsideFront: 0,
        cameras: [],
      }
    : null;
  if (search) {
    sink?.attempt?.searches.push(search);
  }
  // Writes a refused camera into the trace of the search, if any.
  const refuse = (
    azimuth: number,
    elevation: number,
    arc: number,
    refusal: CameraRefusal,
    old = false,
    share: number | null = null,
  ): null => {
    search?.cameras.push({ azimuth, elevation, arc, refusal, kept: old, share });
    return null;
  };
  const tryCamera = (azimuth: number, elevation: number, otherArc: boolean): Framing | null => {
    if (Math.abs(angleDifference(azimuth, subject.front)) > move.maxFromFront) {
      if (search) {
        search.outsideFront++;
      }
      return null;
    }
    let arc = otherArc ? -move.arc : move.arc;
    if (Math.abs(angleDifference(azimuth + arc, subject.front)) > move.maxFromFront) {
      if (otherArc) {
        if (search) {
          search.outsideFront++;
        }
        return null;
      }
      // The move does not reverse the move of the previous shot (design 5.6).
      arc = move.lateral === 0 ? -arc : 0;
    }
    // The camera on the grid around the front, the elevation in 0.1°, and the direction of the
    // arc. A camera that failed its tests before fails again, so it needs no other test.
    const onFront = Math.round(angleDifference(azimuth, subject.front) / (s.azimuthGrid * DEG));
    const key =
      ((onFront + 32) * 1000 + Math.round((elevation / DEG) * 10)) * 3 + Math.sign(arc) + 1;
    let clear = known.get(key);
    if (clear === false) {
      const old = kept?.get(key);
      return old ? refuse(azimuth, elevation, arc, old.refusal, true, old.share) : null;
    }
    const lineKnown = lines.get(key);
    if (lineKnown) {
      return refuse(azimuth, elevation, arc, lineKnown);
    }
    const halfHeight = frames.get(key) ?? heldFrame(azimuth, elevation, arc);
    frames.set(key, halfHeight);
    const from: ShotKey = { azimuth, elevation, zoom: 1, fov: move.fov };
    const to: ShotKey = { azimuth: azimuth + arc, elevation, zoom: move.pushIn, fov: move.fov };
    // The cameras of the move come only for a test that needs them.
    let cameras: ComposedMove | null = null;
    const composed = (): ComposedMove =>
      (cameras ??= composeMove(planner, moveCameras(subject, halfHeight, from, to)));
    if (lineKnown === undefined) {
      const line = lineRefusal(planner, composed());
      lines.set(key, line);
      if (line) {
        return refuse(azimuth, elevation, arc, line);
      }
    }
    if (jumpCut(previous, from, frameSize(planner.stageSide, false, halfHeight, from))) {
      return refuse(azimuth, elevation, arc, 'jump');
    }
    // N7: no repeat of the framing of the last shot of the subject.
    if (move.avoid !== null && Math.abs(angleDifference(azimuth, move.avoid)) < s.repeatAngle) {
      return refuse(azimuth, elevation, arc, 'repeat');
    }
    if (clear === undefined) {
      const refusal = keptRefusal(planner, composed());
      clear = refusal === null;
      known.set(key, clear);
      if (kept && refusal) {
        const share =
          refusal === 'distance'
            ? moveShare(planner.stageSide, subject.target, halfHeight, from, to)
            : null;
        kept.set(key, { refusal, share });
        refuse(azimuth, elevation, arc, refusal, false, share);
      }
    }
    if (!clear) {
      return null;
    }
    search?.cameras.push({ azimuth, elevation, arc, refusal: null, kept: false, share: null });
    return {
      target: subject.target,
      halfHeight,
      from,
      to,
      seats: subject.seats,
      part: subject.part,
      held,
      composition: composed().composition,
    };
  };
  // The low band tries only the wanted elevation, with a full search.
  const full = planner.fullSearch || planner.lowBand;
  const rises = planner.lowBand ? s.elevationSteps.slice(0, 1) : s.elevationSteps;
  let last = -Infinity;
  for (const rise of rises) {
    const elevation = planner.lowBand ? wanted : Math.min(wanted + rise, top);
    if (elevation <= last + 1e-9) {
      break;
    }
    last = elevation;
    if (!planner.lowBand && elevation <= bottom + 1e-9) {
      continue;
    }
    // The steps of the search, then for a full search the places between and beyond them, and
    // then the arc to the other side. The planner keeps the result of each place, so a place
    // that comes again costs little.
    const passes = !full ? 1 : move.arc === 0 || move.lateral !== 0 ? 2 : 3;
    for (let pass = 0; pass < passes; pass++) {
      for (const step of pass === 0 ? s.azimuthSteps : s.fullSteps) {
        for (const side of step === 0 ? [1] : [1, -1]) {
          const framing = tryCamera(move.wantedAzimuth + side * step, elevation, pass === 2);
          if (framing) {
            return framing;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Gives the move to the right of the previous shot.
 *
 * @param planner The planner.
 * @returns -1, 0 for none or for no previous shot, or 1.
 */
function lateralOf(planner: Planner): number {
  return planner.planned.at(-1)?.motion[0] ?? 0;
}

/**
 * Gives the direction of the arc of a new shot (design 5.6): the direction of the move of the
 * previous shot to the right, so that the move does not reverse at the cut. After a shot with no
 * such move, the seeded direction.
 *
 * @param planner The planner.
 * @param seeded The seeded direction, 1 or -1.
 * @returns 1 or -1.
 */
function arcSign(planner: Planner, seeded: number): number {
  const lateral = lateralOf(planner);
  return lateral === 0 ? seeded : lateral;
}

/**
 * Makes the framing of a wide shot: one of the four variants, with a push-in or an arc. The seeded
 * variant, or the next one that makes no jump cut, or else the seeded variant.
 *
 * @param planner The planner.
 * @returns The framing.
 */
function wideFraming(planner: Planner): Framing {
  const random = decisionRandom(planner.seed, planner.cut, 'wide');
  const k = SHOT_KEYS.wide;
  const keyOf = (variant: WideVariant): ShotKey => ({
    azimuth: variant.azimuth * DEG,
    elevation: lowered(
      DEFAULT_TARGET,
      farDistance(planner.stageSide, true, variant.zoom),
      variant.elevation * DEG,
    ),
    zoom: variant.zoom,
    fov: k.fov,
  });
  // The seeded variant, or the next one that makes no jump cut after the previous shot.
  const first = Math.floor(random() * WIDE_VARIANTS.length);
  const previous = planner.planned.at(-1);
  const keys = WIDE_VARIANTS.map((...[, i]) =>
    keyOf(WIDE_VARIANTS[(first + i) % WIDE_VARIANTS.length] ?? WIDE_VARIANTS[0] ?? DEFAULT_WIDE),
  );
  const from =
    keys.find((key) => !jumpCut(previous, key, frameSize(planner.stageSide, true, 0, key))) ??
    keys[0] ??
    defaultKey(1);
  // A variant from the side has the nearest zoom that keeps each player in the frame, so it arcs
  // in place of a push-in. Its push-in to 1.01 put a stage corner of K. 525 out of a 1.6 view.
  const push = random() < 0.5 && from.zoom <= 1;
  const to: ShotKey = push
    ? { ...from, zoom: from.zoom * k.pushIn }
    : { ...from, azimuth: from.azimuth + arcSign(planner, signOf(random)) * k.arc * DEG };
  return {
    target: DEFAULT_TARGET,
    halfHeight: 0,
    from,
    to,
    seats: [],
    part: null,
    held: new Set(),
    composition: null,
  };
}

/**
 * Makes the framing of the opening shot (design 5.6): from the default view of design 4.5, which
 * is also the view of the first screen, a crane down to the low wide view, with a push-in and a
 * zoom in to {@link WIDE_FOV}.
 *
 * @returns The framing.
 */
function openingFraming(planner: Planner): Framing {
  const from = defaultKey(1);
  const zoom = SHOT_KEYS.wide.pushIn;
  const distance = farDistance(planner.stageSide, true, zoom);
  const to = {
    ...defaultKey(zoom),
    elevation: lowered(DEFAULT_TARGET, distance, DEFAULT_ELEVATION),
    fov: WIDE_FOV,
  };
  return {
    target: DEFAULT_TARGET,
    halfHeight: 0,
    from,
    to,
    seats: [],
    part: null,
    held: new Set(),
    composition: null,
  };
}

/**
 * Makes the framing of a high shot, as view 09 of `scene.png`: a seeded azimuth of up to 12° to
 * one side and a nominal elevation of 37° to 41°, with an arc of 8° over the middle and a rise of
 * 4°. When the seeded azimuth makes a jump cut, the largest azimuth on the same side takes its
 * place, so the arc keeps its direction.
 *
 * @param planner The planner.
 * @returns The framing, or `null` when both azimuths make a jump cut.
 */
function highFraming(planner: Planner): Framing | null {
  const random = decisionRandom(planner.seed, planner.cut, 'high');
  const k = SHOT_KEYS.high;
  // The arc goes to the middle, to the other side than the azimuth.
  const side = -arcSign(planner, -signOf(random));
  const seeded = between(random, k.azimuth);
  const target: Vec3 = [0, 0, -0.05 * planner.stageSide];
  const distance = farDistance(planner.stageSide, false, k.zoom);
  const nominal = between(random, k.elevation) * DEG;
  const previous = planner.planned.at(-1);
  for (const degrees of [seeded, k.azimuth[1]]) {
    const azimuth = side * degrees * DEG;
    const from: ShotKey = {
      azimuth,
      elevation: lowered(target, distance, nominal),
      zoom: k.zoom,
      fov: k.fov,
    };
    if (jumpCut(previous, from, frameSize(planner.stageSide, false, 0, from))) {
      continue;
    }
    const to: ShotKey = {
      ...from,
      azimuth: azimuth - side * k.arc * DEG,
      elevation: lowered(target, distance, nominal + k.rise * DEG),
    };
    return {
      target,
      halfHeight: 0,
      from,
      to,
      seats: [],
      part: null,
      held: new Set(),
      composition: null,
    };
  }
  return null;
}

/**
 * Makes the framing of a conductor shot (design 5.6). The shots take turns: the first one, and
 * each odd one, looks over the shoulder of the bear at the orchestra (view 02 of `scene.png`).
 * The other ones show the bear from behind, close (view 05). Both cameras stand on the audience
 * side. When the framing of the turn has no clear camera, the other one fills in.
 *
 * @param planner The planner.
 * @param window The music after the cut.
 * @returns The framing, or `null` with no clear camera or with no conductor.
 */
function conductorFraming(planner: Planner, window: WindowMusic): Framing | null {
  const { subjects } = planner;
  const { conductor } = subjects;
  const random = decisionRandom(planner.seed, planner.cut, 'conductor');
  if (!conductor) {
    return null;
  }
  const back = (): Framing | null => {
    const k = SHOT_KEYS.conductorBack;
    const subject = conductorBackSubject(
      subjects,
      conductor,
      activeMiddle(subjects, window.activity),
    );
    return searchClose(
      planner,
      subject,
      {
        wantedAzimuth: subject.front + signOf(random) * onGrid(between(random, k.offset)),
        elevation: k.elevation * DEG,
        arc: 0,
        pushIn: k.pushIn,
        fov: k.fov,
        avoid: null,
        maxFromFront: KEY_SEARCH.maxFromFront,
        size: SHOT_SIZES.conductorBack,
        ceiling: Infinity,
        lateral: lateralOf(planner),
      },
      'conductor back',
    );
  };
  const close = (): Framing | null => {
    const k = SHOT_KEYS.conductor;
    const subject = conductorCloseSubject(conductor);
    return searchClose(
      planner,
      subject,
      {
        wantedAzimuth: subject.front + signOf(random) * onGrid(between(random, k.offset)),
        elevation: k.elevation * DEG,
        arc: 0,
        pushIn: k.pushIn,
        fov: k.fov,
        avoid: null,
        maxFromFront: KEY_SEARCH.maxFromFront,
        size: SHOT_SIZES.conductor,
        ceiling: Infinity,
        lateral: lateralOf(planner),
      },
      'conductor close',
    );
  };
  return planner.conductorShots % 2 === 0 ? (back() ?? close()) : (close() ?? back());
}

/**
 * Gives the subject of the rule of no repeat of a framing (design 5.6, N7): the side, the seat, or
 * the section group. A part of a choir seat, such as the sopranos, has the group of its seat.
 *
 * @param candidate The kind, the id, and the group of the shot.
 * @returns The subject, for example `section choir`.
 */
function framingSubject(candidate: Pick<Candidate, 'kind' | 'id' | 'group'>): string {
  return candidate.kind === 'section' && candidate.group
    ? `section ${candidate.group}`
    : candidate.id;
}

/**
 * Makes the framing of a candidate, with a clear camera.
 *
 * @param planner The planner.
 * @param candidate The candidate.
 * @param window The music after the cut.
 * @returns The framing, or `null` with no clear camera.
 */
function framingOf(planner: Planner, candidate: Candidate, window: WindowMusic): Framing | null {
  const { subjects } = planner;
  const random = decisionRandom(planner.seed, planner.cut, candidate.id);
  switch (candidate.kind) {
    case 'wide': {
      // A wide candidate whose variants all make a jump cut has no camera.
      const framing = wideFraming(planner);
      const size = frameSize(planner.stageSide, true, 0, framing.from);
      return jumpCut(planner.planned.at(-1), framing.from, size) ? null : framing;
    }
    case 'high':
      return highFraming(planner);
    case 'conductor':
      return conductorFraming(planner, window);
    case 'side': {
      const k = SHOT_KEYS.side;
      const subject = sideSubject(subjects, candidate.seats, candidate.side ?? -1);
      if (!subject) {
        return null;
      }
      return searchClose(
        planner,
        subject,
        {
          wantedAzimuth:
            subject.front +
            offsetSign(planner, subject, signOf(random)) * onGrid(between(random, k.offset)),
          elevation: k.elevation * DEG,
          arc: arcSign(planner, signOf(random)) * k.arc * DEG,
          pushIn: k.pushIn,
          fov: k.fov,
          avoid: planner.lastAzimuth.get(framingSubject(candidate)) ?? null,
          maxFromFront: KEY_SEARCH.sideFromFront,
          ceiling: KEY_SEARCH.sideCeiling,
          size: SHOT_SIZES.side,
          lateral: lateralOf(planner),
        },
        candidate.id,
      );
    }
    case 'section': {
      const k = SHOT_KEYS.section;
      const subject = sectionSubject(
        subjects,
        candidate.seats,
        candidate.group === 'ensemble' ? SUBJECT_SIZES.twoShotMargin : SUBJECT_SIZES.sectionMargin,
        candidate.part,
      );
      if (!subject) {
        return null;
      }
      return searchClose(
        planner,
        subject,
        {
          wantedAzimuth:
            subject.front +
            offsetSign(planner, subject, signOf(random)) *
              onGrid(between(random, k.offset) * subject.spread),
          elevation: (k.elevation + k.backRise * subject.back) * DEG + subject.lift,
          arc: arcSign(planner, signOf(random)) * k.arc * DEG,
          pushIn: k.pushIn,
          fov: k.fov,
          avoid: planner.lastAzimuth.get(framingSubject(candidate)) ?? null,
          maxFromFront: KEY_SEARCH.maxFromFront,
          size: SHOT_SIZES.section,
          ceiling: Infinity,
          lateral: lateralOf(planner),
        },
        candidate.id,
      );
    }
    case 'solo': {
      const k = SHOT_KEYS.solo;
      const subject = soloSubject(subjects, candidate.seats[0] ?? -1);
      if (!subject) {
        return null;
      }
      return searchClose(
        planner,
        subject,
        {
          wantedAzimuth:
            subject.front +
            offsetSign(planner, subject, signOf(random)) *
              onGrid(between(random, k.offset) * subject.spread),
          elevation: (k.elevation + k.backRise * subject.back) * DEG + subject.lift,
          arc: arcSign(planner, signOf(random)) * k.arc * DEG,
          pushIn: k.pushIn,
          fov: k.fov,
          avoid: planner.lastAzimuth.get(framingSubject(candidate)) ?? null,
          maxFromFront: KEY_SEARCH.maxFromFront,
          size: SHOT_SIZES.solo,
          ceiling: Infinity,
          lateral: lateralOf(planner),
        },
        candidate.id,
      );
    }
  }
}

/**
 * Lists the candidates for the shot at a cut, with their scores (design 5.6).
 *
 * @param planner The planner.
 * @param cut The cut, in song seconds.
 * @param window The music of the window after the cut.
 * @returns The candidates, with the rules of the choice applied, best first.
 */
function candidatesAt(planner: Planner, cut: number, window: WindowMusic): Candidate[] {
  const w = CHOICE_WEIGHTS;
  const { music, subjects, planned } = planner;
  // The seats that entered in the bar before the cut, or that enter at it.
  const bar = barLengthAt(music, cut);
  const entering = new Set(
    entriesIn(music, cut - ENTRY_REACH.after * bar - 1e-6, cut + ENTRY_REACH.before * bar + 1e-6),
  );
  // The seats that rest at the cut and enter later in the window. A shot of such a seat showed it
  // silent until its entry, and then rule 1 cut away from it at its entry.
  const later = cut + ENTRY_REACH.before * bar + 1e-6;
  const pending = new Set(restingIn(music, cut + 1e-6, later, cut + SHOT_TIMES.choiceWindowSec));
  if (planned.length === 1) {
    // The first cut after the opening: each active seat that played its first note in the
    // opening counts as an entry, so the first voice gets its shot.
    for (const [seat, notes] of music.seats.entries()) {
      const first = notes.starts[0];
      if (first !== undefined && first < cut && window.active[seat]) {
        entering.add(seat);
      }
    }
  }
  const total = Math.max(1e-9, window.totalActivity);
  const tutti = window.tutti;
  // A group with fewer than 3 seats gets no high shot and no section shot, but a two-shot.
  const { staged } = planner;
  const small = staged.length < SMALL_GROUP_SEATS;
  const list: Candidate[] = [];
  const add = (
    kind: ShotKind,
    id: string,
    group: SectionGroup | null,
    seats: number[],
    score: number,
    side: StageSide | null = null,
    part: readonly number[] | null = null,
  ): void => {
    list.push({
      kind,
      id,
      group,
      side,
      seats,
      part,
      score,
      entering: seats.filter((s) => entering.has(s)),
      tier: TIERS.other,
    });
  };
  // N6: a wide view at least every 60 s. When the last shot starts more than 60 s after the last
  // wide view, a wide view also comes at one of the last cuts with room for it (rule 3).
  const t = SHOT_TIMES;
  const lateLast = planner.lastStart - planner.lastWideEnd > t.maxWideGapSec;
  const lastRoom = planner.lastStart - cut < t.minSec + roomBeforeLast(0) + t.maxSec;
  // A wide view that cannot wait for the next cut wins over an entry.
  const forced = cut + t.minSec > planner.lastWideEnd + t.maxWideGapSec || (lateLast && lastRoom);
  const due = cut - planner.lastWideEnd >= t.wideDueSec || forced ? w.wideDue : 0;
  add('wide', 'wide', null, [], w.wide + (tutti ? w.wideTutti : 0) + due);
  if (!small) {
    add(
      'high',
      'high',
      null,
      [],
      w.high + (tutti ? w.highTutti : 0) + (window.activeCount >= 6 ? w.highBusy : 0) + due,
    );
  }
  // A chamber group has no conductor (design 4.2), and a small group shows no conductor.
  if (subjects.conductor && !small) {
    add(
      'conductor',
      'conductor',
      null,
      [],
      w.conductor + (window.activeCount >= 5 ? w.conductorBusy : 0),
    );
  }
  // The side views: the seats of each side that play or enter, with the most activity first.
  if (!small) {
    for (const side of [-1, 1] as const) {
      const seats = staged
        .filter(
          (s) =>
            (window.active[s] || entering.has(s)) &&
            !pending.has(s) &&
            sideOf(subjects, s) === side,
        )
        .toSorted((a, b) => (window.activity[b] ?? 0) - (window.activity[a] ?? 0) || a - b);
      if (seats.length < 2) {
        continue;
      }
      const activity = seats.reduce((sum, s) => sum + (window.activity[s] ?? 0), 0);
      const piano = seats.some((s) => subjects.seats[s]?.group === 'piano');
      add(
        'side',
        `side ${side}`,
        null,
        seats,
        w.side +
          w.sideShare * (activity / total) +
          (seats.some((s) => entering.has(s)) ? w.sideEntry : 0) +
          (piano ? w.sidePiano : 0),
        side,
      );
    }
  }
  const groups = new Map<SectionGroup, number[]>();
  for (const [seat, players] of subjects.seats.entries()) {
    if (!players || !(window.active[seat] || entering.has(seat)) || pending.has(seat)) {
      continue;
    }
    const seats = groups.get(players.group) ?? [];
    seats.push(seat);
    groups.set(players.group, seats);
    const share = (window.activity[seat] ?? 0) / total;
    const exposed = window.activeCount <= 3 || entering.size > 0;
    const feature = players.group === 'piano' || players.group === 'harp';
    add(
      'solo',
      `solo ${seat}`,
      players.group,
      [seat],
      w.solo +
        w.soloShare * share +
        (exposed ? w.soloExposed : 0) +
        (entering.has(seat) ? w.soloEntry : 0) +
        (window.lead[seat] ? w.soloLead : 0) +
        (feature ? w.soloFeature : 0) +
        (tutti ? w.soloTutti : 0),
    );
  }
  if (small) {
    // The two-shot holds all players of the stage, also the seats that rest.
    groups.clear();
    const players = staged.reduce((sum, s) => sum + (subjects.seats[s]?.players.length ?? 0), 0);
    if (players >= 2) {
      groups.set('ensemble', [...staged]);
    }
  }
  const sectionScore = (seats: readonly number[]): number =>
    w.section +
    w.sectionShare * (seats.reduce((sum, s) => sum + (window.activity[s] ?? 0), 0) / total) +
    (seats.some((s) => entering.has(s)) ? w.sectionEntry : 0) +
    (seats.some((s) => window.lead[s]) ? w.sectionLead : 0) +
    (tutti ? w.sectionTutti : 0);
  for (const [group, seats] of groups) {
    const sorted = seats.toSorted(
      (a, b) => (window.activity[b] ?? 0) - (window.activity[a] ?? 0) || a - b,
    );
    add(
      'section',
      group === 'ensemble' ? 'two-shot' : `section ${group}`,
      group,
      sorted,
      sectionScore(seats),
    );
  }
  // The part of a choir that sings the tune, for example the sopranos: a section shot of its
  // players, with the score of a section shot of its seat.
  for (const [seat, part] of window.tunePlayers.entries()) {
    const players = subjects.seats[seat]?.players.length ?? 0;
    if (!small && part && part.length > 0 && part.length < players && !pending.has(seat)) {
      add('section', `part ${seat}`, 'choir', [seat], sectionScore([seat]), null, part);
    }
  }

  // The rank of a candidate. A soloist is the soloist of the score, or a seat with one player
  // that carries the lead: its entry wins over the entry of a section.
  const tierOf = (candidate: Candidate): Tier => {
    if ((candidate.kind === 'wide' || candidate.kind === 'high') && forced) {
      return TIERS.forced;
    }
    if (candidate.entering.length === 0) {
      return TIERS.other;
    }
    const seat = candidate.seats[0] ?? -1;
    const alone = subjects.seats[seat]?.players.length === 1 && (window.lead[seat] ?? false);
    const soloist = candidate.kind === 'solo' && (seat === subjects.soloist || alone);
    return soloist ? TIERS.soloist : TIERS.entry;
  };

  const previous = planned.at(-1);
  const recent = new Set(planned.slice(-4).map((p) => p.id));
  const uses = new Map<string, number>();
  for (const p of planned) {
    uses.set(p.id, (uses.get(p.id) ?? 0) + 1);
  }
  const wideRoom = planner.lastStart - cut >= SHOT_TIMES.minSec + roomBeforeLast(0);
  // A player alone can have two solo shots in a row, from two cameras: the jump cut rule and the
  // rule of no repeat of a framing keep them apart.
  const alone = staged.length === 1;
  const dropped = planner.trace?.cut?.dropped ?? null;
  // Writes a candidate that a rule drops into the trace of the cut, if any.
  const drop = (candidate: Candidate, rule: ChoiceRule): void => {
    dropped?.push({ id: candidate.id, kind: candidate.kind, rule });
  };
  const scored: Candidate[] = [];
  for (const candidate of list) {
    const close = candidate.kind === 'section' || candidate.kind === 'solo';
    const reused = close || candidate.kind === 'side';
    const wideKind = candidate.kind === 'wide' || candidate.kind === 'high';
    const again = alone && candidate.kind === 'solo';
    // Rule 1: no repeat of the kind and the subject.
    if (previous && candidate.id === previous.id && !again) {
      drop(candidate, 'subject');
      continue;
    }
    // Rule 2: no section or solo shot of the group of the previous shot.
    if (close && previous?.group === candidate.group && !again) {
      drop(candidate, 'group');
      continue;
    }
    // Rule 3: three other shots between two wide or high shots, also from the start, and room for
    // them before the last shot. Thus the wide and high shots after the opening are at most 25%.
    if (wideKind && (planner.sinceWide < SHOT_TIMES.wideSpacing || !wideRoom)) {
      drop(candidate, planner.sinceWide < SHOT_TIMES.wideSpacing ? 'wideSpacing' : 'wideRoom');
      continue;
    }
    // Rule 3b: five other shots between two conductor shots, also from the start.
    if (candidate.kind === 'conductor' && planner.sinceConductor < SHOT_TIMES.conductorSpacing) {
      drop(candidate, 'conductorSpacing');
      continue;
    }
    // Rule 3c: three other shots between two side views, also from the start.
    if (candidate.kind === 'side' && planner.sinceSide < SHOT_TIMES.sideSpacing) {
      drop(candidate, 'sideSpacing');
      continue;
    }
    let score = candidate.score;
    // Rule 4: variety.
    if (recent.has(candidate.id)) {
      score += w.recent;
    }
    if (reused) {
      score += w.reuse * (uses.get(candidate.id) ?? 0);
    }
    // Rule 5: seeded jitter.
    score += (decisionRandom(planner.seed, cut, `jitter ${candidate.id}`)() - 0.5) * w.jitter;
    scored.push({ ...candidate, score, tier: tierOf(candidate) });
  }
  return scored.toSorted((a, b) => b.tier - a.tier || b.score - a.score);
}

/**
 * Gives the time that a shot leaves before the start of the last shot, so that the last wide
 * shot also has three other shots since the last wide or high shot.
 *
 * @param after The number of shots since the last wide or high shot, with this shot.
 * @returns The time in seconds, or 0 if the shot can end at the start of the last shot.
 */
function roomBeforeLast(after: number): number {
  const missing = SHOT_TIMES.wideSpacing - after;
  return missing <= 0 ? 0 : missing * SHOT_TIMES.roomSec;
}

/**
 * Gives the bonus of a cut at an entry (design 5.6). A cut from a quarter of a bar before an entry
 * to one bar after it is a cut at the entry, and a later cut gets less.
 *
 * @param music The music of the score.
 * @param time The time of the cut, in song seconds.
 * @returns The bonus.
 */
function entryBonus(music: ScoreMusic, time: number): number {
  const bar = barLengthAt(music, time);
  const reach = ENTRY_REACH;
  let bonus = 0;
  for (let k = lastAtOrBefore(music.entryStarts, time + reach.before * bar + 1e-6); k >= 0; k--) {
    const start = music.entryStarts[k] ?? 0;
    if (start < time - reach.after * bar - 1e-6) {
      break;
    }
    const delay = Math.max(0, time - start) / bar;
    bonus = Math.max(bonus, CUT_BONUS.entry - CUT_BONUS.entryDelay * delay);
  }
  return bonus;
}

/**
 * Gives the middle beat of a bar with an even number of beats (design 5.6, N5).
 *
 * @param music The music of the score.
 * @param bar The index of the bar.
 * @returns The time of the middle beat, or `undefined` for a bar with no such beat or no end.
 */
function middleBeat(music: ScoreMusic, bar: number): number | undefined {
  const start = music.downbeats[bar];
  const next = music.downbeats[bar + 1];
  if (start === undefined || next === undefined) {
    return undefined;
  }
  const middle = (start + next) / 2;
  const beat = music.beats[lastAtOrBefore(music.beats, middle + 1e-6)];
  return beat !== undefined && Math.abs(beat - middle) < 1e-3 ? middle : undefined;
}

/** The first entry in reach of a range of cuts, with the end of its reach. */
interface EntryReach {
  /** The start of the entry, in song seconds. */
  readonly start: number;
  /** The last cut at the entry in the range: one bar after it, or the end of the range. */
  readonly latest: number;
}

/**
 * Finds the first entry that a cut point in a time range can show (design 5.6): a downbeat or the
 * middle beat of a bar, from a quarter of a bar before the entry to one bar after it.
 *
 * @param music The music of the score.
 * @param from The first time of the range, in song seconds.
 * @param to The last time of the range, in song seconds.
 * @returns The entry and the end of its reach, or `null` with no entry in reach of the range.
 */
function firstEntryReach(music: ScoreMusic, from: number, to: number): EntryReach | null {
  const { downbeats, entryStarts } = music;
  const reach = ENTRY_REACH;
  const first = lastAtOrBefore(entryStarts, from - reach.after * barLengthAt(music, from));
  for (let k = Math.max(0, first); k < entryStarts.length; k++) {
    const start = entryStarts[k] ?? 0;
    const bar = barLengthAt(music, start);
    const earliest = Math.max(from, start - reach.before * bar);
    const latest = Math.min(to, start + reach.after * bar);
    if (earliest > to + 1e-9) {
      return null;
    }
    for (let i = Math.max(0, lastAtOrBefore(downbeats, earliest)); i < downbeats.length; i++) {
      const times = [downbeats[i] ?? Infinity, middleBeat(music, i) ?? Infinity];
      if (times.some((time) => time >= earliest - 1e-9 && time <= latest + 1e-9)) {
        return { start, latest };
      }
      if ((downbeats[i + 1] ?? Infinity) > latest + 1e-9) {
        break;
      }
    }
  }
  return null;
}

/**
 * Finds the best cut of a shot among the downbeats and the middle beats (design 5.6), by the
 * distance from the wanted length, the phrase lines, the length of the previous shot, and the
 * entries.
 *
 * @param planner The planner.
 * @param start The start of the shot.
 * @param wanted The wanted end of the shot.
 * @param fits Tells if a cut is in the window of the shot.
 * @returns The cut, or `undefined` if no downbeat and no middle beat fits.
 */
function bestCut(
  planner: Planner,
  start: number,
  wanted: number,
  fits: (time: number) => boolean,
): number | undefined {
  const { music } = planner;
  const shortest = start + SHOT_TIMES.minSec;
  const previous = planner.planned.at(-1)?.shot;
  let best: number | undefined;
  let bestScore = -Infinity;
  const consider = (time: number, bonus: number): void => {
    if (!fits(time)) {
      return;
    }
    let score = -Math.abs(time - wanted) / SHOT_TIMES.lengthScale + bonus + entryBonus(music, time);
    if (previous && Math.abs(time - start - (previous.endSec - previous.startSec)) < 0.05) {
      score += CUT_BONUS.sameLength;
    }
    if (score > bestScore) {
      bestScore = score;
      best = time;
    }
  };

  const first = Math.max(0, lastAtOrBefore(music.downbeats, shortest - 1e-6) + 1);
  for (let bar = Math.max(0, first - 1); bar < music.downbeats.length; bar++) {
    const time = music.downbeats[bar] ?? 0;
    if (time > start + SHOT_TIMES.maxWideSec + 1e-9) {
      break;
    }
    if (bar >= first) {
      consider(time, bar % 4 === 0 ? CUT_BONUS.phrase : bar % 2 === 0 ? CUT_BONUS.halfPhrase : 0);
    }
    // The beat in the middle of the bar, in a bar with an even number of beats (N5).
    const middle = middleBeat(music, bar);
    if (middle !== undefined) {
      consider(middle, CUT_BONUS.midBar);
    }
  }

  return best;
}

/**
 * Chooses the end of a shot (design 5.6): the best downbeat from 4 s to 14 s after the start (18 s
 * for a wide or high shot), by the distance from the wanted length, the phrase lines, and the
 * entries. The first entry after the shortest length ends the shot. With no downbeat in the
 * window, the cut falls on the beat nearest to the wanted time. Each end leaves room for the
 * shots before the last shot. A short song that has no such room keeps only the window.
 *
 * @param planner The planner.
 * @param start The start of the shot.
 * @param kind The kind of the shot.
 * @param latest The latest end, in song seconds: the longest length of a shot that holds on.
 * @returns The end of the shot, in song seconds.
 */
function chooseEnd(
  planner: Planner,
  start: number,
  kind: ShotKind,
  latest = Infinity,
  subject: readonly number[] = [],
): number {
  const t = SHOT_TIMES;
  const { music, lastStart } = planner;
  const wideKind = kind === 'wide' || kind === 'high';
  const random = decisionRandom(planner.seed, start, 'end');
  let wanted = start + between(random, wideKind ? t.wideWanted : t.closeWanted);
  let longest = Math.min(start + (wideKind ? t.maxWideSec : t.maxSec), latest);
  if (!wideKind && planner.lastWideEnd + t.maxWideGapSec >= start + t.minSec) {
    // N6: the next cut comes in time for a wide view.
    longest = Math.min(longest, planner.lastWideEnd + t.maxWideGapSec);
  }
  const shortest = start + t.minSec;
  if ((kind === 'solo' || kind === 'section') && subject.length > 0) {
    // The subject rests: the shot ends in the bar after its last note, so that the camera does
    // not hold on players that do not play. A short rest before it plays again keeps the shot.
    const rest = subjectRestIn(music, subject, start, longest);
    if (rest !== null) {
      const bar = barLengthAt(music, rest);
      // At least one bar after the shortest length, which holds a downbeat to cut on.
      longest = Math.min(longest, Math.max(shortest, rest) + t.restHoldBars * bar);
      wanted = Math.min(wanted, Math.max(shortest, rest + (t.restHoldBars * bar) / 2));
    }
  }
  // The first entry after the shortest length ends the shot: the cut falls in the reach of the
  // entry, when a cut there fits.
  const entry = firstEntryReach(music, shortest, longest);
  if (entry) {
    wanted = Math.max(shortest, entry.start);
  }
  const room = roomBeforeLast(wideKind ? 0 : planner.sinceWide + 1);

  for (const strict of [true, false]) {
    const fits = (time: number): boolean => {
      if (time < shortest - 1e-9 || time > longest + 1e-9) {
        return false;
      }
      if (Math.abs(time - lastStart) < 1e-9) {
        return room === 0 || !strict;
      }
      return time <= lastStart - Math.max(t.minSec, strict ? room : 0) + 1e-9;
    };
    for (const end of entry ? [entry.latest, longest] : [longest]) {
      const cut = bestCut(planner, start, wanted, (time) => time <= end + 1e-9 && fits(time));
      if (cut !== undefined) {
        return cut;
      }
    }
    // No downbeat fits: the beat nearest to the wanted time.
    let best = Number.NaN;
    for (const time of music.beats) {
      if (fits(time) && (Number.isNaN(best) || Math.abs(time - wanted) < Math.abs(best - wanted))) {
        best = time;
      }
    }
    if (!Number.isNaN(best)) {
      return best;
    }
  }

  return lastStart - start <= (wideKind ? t.maxWideSec : t.maxSec)
    ? lastStart
    : Math.min(wanted, lastStart - t.minSec);
}

/**
 * Tells if two neighbor shots blend (design 5.6): slow or soft music, two close shots, cameras
 * less than `0.35 × S` apart, and a clear straight path between them that stays on one side of
 * the cone of the beam. Each animal in the frame of the blend keeps `ANIMAL_FLOOR`, else the
 * shots meet in a hard cut.
 *
 * @param planner The planner.
 * @param previous The previous shot.
 * @param next The framing of the next shot.
 * @param kind The kind of the next shot.
 * @param window The music after the cut.
 * @param cut The cut, in song seconds.
 * @param end The end of the move of the next shot, in song seconds.
 * @returns The blend time in seconds, or 0 for a hard cut.
 */
function blendOf(
  planner: Planner,
  previous: PlannedShot,
  next: Framing,
  kind: ShotKind,
  window: WindowMusic,
  cut: number,
  end: number,
): number {
  const r = BLEND_RULES;
  const beat = beatLengthAt(planner.music, cut);
  if (beat < r.slowBeatSec && window.meanLoudness > r.softLoudness) {
    return 0;
  }
  if (!isCloseShot(previous.shot.kind) || !isCloseShot(kind)) {
    return 0;
  }
  const S = planner.stageSide;
  const held = new Set([...previous.held, ...next.held]);
  const shot = previous.shot;
  const a = keyPosition(S, shot.target, shot.halfHeight, shot.to, CINEMA_ASPECT);
  const b = keyPosition(S, next.target, next.halfHeight, next.from, CINEMA_ASPECT);
  if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) >= r.nearInSides * S) {
    return 0;
  }
  if (!pathClear(planner.clearance, a, b, shot.target, next.target, held)) {
    return 0;
  }
  const side = beamSide(S, a);
  const crosses =
    side === 'edge' || MOVE_SAMPLES.some((u) => beamSide(S, mixPoints(a, b, u)) !== side);
  if (crosses) {
    return 0;
  }
  const blend = Math.min(r.maxSec, Math.max(r.minSec, beat));
  return blendNear(planner, shot, next, blend, end - cut) ? 0 : blend;
}

/**
 * Tells if the straight path of a blend is clear: each point of it keeps its distances, and sees
 * its target.
 *
 * @param clearance The obstacles.
 * @param a The camera at the start.
 * @param b The camera at the end.
 * @param targetA The target at the start.
 * @param targetB The target at the end.
 * @param held The boxes of the bodies of the two subjects.
 * @returns True if the path is clear.
 */
function pathClear(
  clearance: StageClearance,
  a: Vec3,
  b: Vec3,
  targetA: Vec3,
  targetB: Vec3,
  held: ReadonlySet<ClearBox>,
): boolean {
  if (Math.min(a[1], b[1]) < CLEARANCE.height) {
    return false;
  }
  const segment: Segment = { ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2] };
  if (!segmentClear(clearance, segment, 'clearance', held)) {
    return false;
  }
  return SIGHT_SAMPLES.every((u) => {
    const p: Vec3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const t: Vec3 = [
      targetA[0] + (targetB[0] - targetA[0]) * u,
      targetA[1] + (targetB[1] - targetA[1]) * u,
      targetA[2] + (targetB[2] - targetA[2]) * u,
    ];
    return cameraClear(clearance, t, p, p, held);
  });
}

/**
 * Adds a shot to the plan.
 *
 * @param planner The planner.
 * @param candidate The kind and the subject.
 * @param framing The keys and the subject.
 * @param times The start, the end, the end of the move, and the blend.
 */
function addShot(
  planner: Planner,
  candidate: Pick<Candidate, 'kind' | 'id' | 'group'>,
  framing: Framing,
  times: Pick<Shot, 'startSec' | 'endSec' | 'moveEndSec' | 'blendSec'>,
): void {
  const { kind } = candidate;
  const wideKind = kind === 'wide' || kind === 'high';
  planner.planned.push({
    shot: {
      kind,
      ...times,
      seats: framing.seats,
      part: framing.part,
      target: framing.target,
      halfHeight: framing.halfHeight,
      composition: framing.composition,
      from: framing.from,
      to: framing.to,
    },
    id: candidate.id,
    group: candidate.group,
    size: frameSize(planner.stageSide, kind === 'wide', framing.halfHeight, framing.to),
    motion: motionOf(framing.from, framing.to),
    held: framing.held,
  });
  if (kind === 'section' || kind === 'solo' || kind === 'side') {
    planner.lastAzimuth.set(framingSubject(candidate), framing.from.azimuth);
  }
  planner.sinceSide = kind === 'side' ? 0 : planner.sinceSide + 1;
  planner.sinceWide = wideKind ? 0 : planner.sinceWide + 1;
  if (wideKind) {
    planner.lastWideEnd = Math.max(times.endSec, planner.lastWideEnd);
  }
  if (kind === 'conductor') {
    planner.sinceConductor = 0;
    planner.conductorShots++;
  } else {
    planner.sinceConductor++;
  }
}

/**
 * Makes the previous shot longer when no subject fits at a cut (design 5.6). Its new end is the
 * end that a shot of its kind from the cut would get within the longest length of the previous
 * shot, and its move takes the longer time. The slower move changes the path of a blend into the
 * shot, so the blend becomes a hard cut when its path no longer keeps `ANIMAL_FLOOR`.
 *
 * @param planner The planner.
 * @param cut The cut, in song seconds.
 * @returns The new end in song seconds, or `null` if the shot would pass its longest length.
 */
function holdPrevious(planner: Planner, cut: number): number | null {
  const last = planner.planned.at(-1);
  if (!last) {
    return null;
  }
  const { kind, startSec } = last.shot;
  const wideKind = kind === 'wide' || kind === 'high';
  const longest = Math.max(0, startSec) + (wideKind ? SHOT_TIMES.maxWideSec : SHOT_TIMES.maxSec);
  const end = Math.min(chooseEnd(planner, cut, kind, longest), planner.lastStart);
  if (end > longest + 1e-9) {
    return null;
  }
  const before = planner.planned.at(-2)?.shot;
  const { blendSec } = last.shot;
  const blend =
    before && blendSec > 0 && blendNear(planner, before, last.shot, blendSec, end - startSec)
      ? 0
      : blendSec;
  planner.planned[planner.planned.length - 1] = {
    ...last,
    shot: { ...last.shot, endSec: end, moveEndSec: end, blendSec: blend },
  };
  if (wideKind) {
    planner.lastWideEnd = end;
  }
  return end;
}

/**
 * Finds the start of the last shot: the last downbeat at least 8 s before the song end, and at
 * least 4 s after the song start.
 *
 * @param music The music of the score.
 * @param durationSec The song length.
 * @returns The start, in song seconds.
 */
function lastStartOf(music: ScoreMusic, durationSec: number): number {
  const i = lastAtOrBefore(music.downbeats, durationSec - SHOT_TIMES.lastLeadSec);
  const time = music.downbeats[i];
  return time !== undefined && time >= SHOT_TIMES.minSec ? time : SHOT_TIMES.minSec;
}

/**
 * Makes a new trace of a cut.
 *
 * @param cutSec The cut, in song seconds.
 * @returns The trace, with no candidates, no chosen candidate, and the outcome `candidate`.
 */
function cutTrace(cutSec: number): CutTrace {
  return { cutSec, dropped: [], candidates: [], chosen: null, fill: [], outcome: 'candidate' };
}

/**
 * Starts the trace of a try, and makes it the try that the planner traces now.
 *
 * @param sink The trace of the plan.
 * @param attempts The tries of the candidate or of the fill.
 * @param band The index of the band, or `null` for all bands.
 * @returns The trace of the try.
 */
function startAttempt(
  sink: TraceSink,
  attempts: AttemptTrace[],
  band: number | null,
): AttemptTrace {
  const attempt: AttemptTrace = { band, searches: [], found: false };
  attempts.push(attempt);
  sink.attempt = attempt;
  return attempt;
}

/**
 * Calculates the shots of a score (design 5.6), and writes the choice at each cut of the range
 * of a trace into the trace.
 *
 * @param score The score.
 * @param layout The layout of the score, from `layoutScene()`.
 * @param seed The seed of the plan.
 * @param models The player models of the score, which the layout shares.
 * @param trace The trace to write, or `null` for a plan with no trace.
 * @returns The steps, which return the plan for `cameraAt()`.
 */
function* planShotsSteps(
  score: Score,
  layout: SceneLayout,
  seed: number,
  models: ModelCache,
  trace: TraceSink | null,
): Steps<ShotPlan> {
  const music = prepareMusic(score);
  yield;
  const subjects = prepareSubjects(score, layout, models);
  yield;
  const bodies = prepareBodies(layout, models);
  yield;
  const planner: Planner = {
    music,
    subjects,
    bodies,
    clearance: prepareClearance(layout, models),
    stageSide: layout.stageSide,
    master: defaultView(layout.stageSide, CINEMA_ASPECT, 1).position,
    seed,
    cut: 0,
    lastStart: lastStartOf(music, score.durationSec),
    planned: [],
    sightCache: new Map(),
    moveCache: new Map(),
    frameCache: new Map(),
    lineCache: new Map(),
    sinceWide: 0,
    lastWideEnd: 0,
    staged: subjects.seats.flatMap((players, seat) => (players ? [seat] : [])),
    sinceConductor: 0,
    conductorShots: 0,
    sinceSide: 0,
    lastAzimuth: new Map(),
    band: [-Infinity, KEY_SEARCH.bands[0] ?? 0],
    lowBand: false,
    fullSearch: false,
    trace,
  };

  // The opening: the default view of the first screen holds for the count-in, then it cranes down
  // and pushes in slowly over the first phrase. The click on play thus makes no cut.
  let cut = chooseEnd(planner, 0, 'wide');
  addShot(planner, { kind: 'wide', id: 'wide', group: null }, openingFraming(planner), {
    startSec: -Infinity,
    endSec: cut,
    moveEndSec: cut,
    blendSec: 0,
  });

  while (cut < planner.lastStart - 1e-9) {
    yield;
    planner.cut = cut;
    const window = musicIn(music, cut, cut + SHOT_TIMES.choiceWindowSec);
    let chosen: { candidate: Candidate; framing: Framing } | null = null;
    const traced =
      trace && cut >= trace.range.fromSec - 1e-9 && cut <= trace.range.toSec + 1e-9
        ? cutTrace(cut)
        : null;
    if (trace) {
      trace.cut = traced;
      trace.attempt = null;
      if (traced) {
        trace.cuts.push(traced);
      }
    }
    const scored = candidatesAt(planner, cut, window);
    // The framings of the entry of the best candidate: each candidate that shows a seat that
    // enters with it. They come first, so that the entry keeps its shot when the best framing has
    // no clear camera.
    const entry = new Set(scored[0]?.entering);
    const ofEntry = (c: Candidate): boolean => c.entering.some((seat) => entry.has(seat));
    const candidates = [...scored.filter(ofEntry), ...scored.filter((c) => !ofEntry(c))];
    const traces: CandidateTrace[] = candidates.map((c) => ({
      id: c.id,
      kind: c.kind,
      score: c.score,
      tier: TIER_NAMES[c.tier],
      entering: c.entering,
      attempts: [],
    }));
    traced?.candidates.push(...traces);
    // The low band first, then the lowest elevation band. A candidate near the best score gets
    // the second elevation band too. The other candidates get the higher bands only after all
    // candidates failed (N4).
    const lead = (scored[0]?.score ?? 0) - KEY_SEARCH.bandMargin;
    const bands = KEY_SEARCH.bands.length + 1;
    for (const higher of [false, true]) {
      for (const [index, candidate] of candidates.entries()) {
        // The first pass: the low band and the first elevation band, the second elevation band
        // for a candidate near the best, and all bands for the best candidate at its entry. Each
        // candidate that shows an entering seat gets the second elevation band and a full search.
        // The second pass: the bands that the candidate did not get.
        const entering = candidate.entering.length > 0;
        const best = entering && candidate === scored[0];
        const first = best ? bands : entering || candidate.score >= lead ? 3 : 2;
        planner.fullSearch = entering;
        for (let band = higher ? first : 0; band < (higher ? bands : first); band++) {
          planner.lowBand = band === 0;
          planner.band = [KEY_SEARCH.bands[band - 2] ?? -Infinity, KEY_SEARCH.bands[band - 1] ?? 0];
          yield;
          const attempt =
            trace && traced ? startAttempt(trace, traces[index]?.attempts ?? [], band) : null;
          const framing = framingOf(planner, candidate, window);
          if (attempt) {
            attempt.found = framing !== null;
          }
          if (framing) {
            chosen = { candidate, framing };
            if (traced) {
              traced.chosen = index;
            }
            break;
          }
        }
        if (chosen) {
          break;
        }
      }
      if (chosen) {
        break;
      }
    }
    // A conductor shot that fills the time searches all bands.
    planner.band = [-Infinity, KEY_SEARCH.bands.at(-1) ?? 0];
    planner.lowBand = false;
    planner.fullSearch = false;
    if (trace) {
      trace.attempt = null;
    }
    if (!chosen) {
      // No subject fits, for example in a rest of all seats. The previous shot holds on while it
      // stays within its longest length, so that no wide shot comes just before the last shot.
      // Else the conductor fills the time, also against rule 3b, because it conducts the rest.
      // Else a wide shot fills the time.
      const held = holdPrevious(planner, cut);
      if (held !== null) {
        if (traced) {
          traced.outcome = 'hold';
        }
        cut = held;
        continue;
      }
      const conductor: Candidate = {
        kind: 'conductor',
        id: 'conductor',
        group: null,
        side: null,
        seats: [],
        part: null,
        score: 0,
        entering: [],
        tier: TIERS.other,
      };
      // After a conductor shot, the other framing of the conductor fills the time. The jump cut
      // rule keeps the two views apart. A small group shows no conductor.
      const small = planner.staged.length < SMALL_GROUP_SEATS;
      const attempt = trace && traced && !small ? startAttempt(trace, traced.fill, null) : null;
      const framing = small ? null : conductorFraming(planner, window);
      if (attempt) {
        attempt.found = framing !== null;
      }
      if (trace) {
        trace.attempt = null;
      }
      if (traced) {
        traced.outcome = framing ? 'conductor' : 'wide';
      }
      if (framing) {
        chosen = { candidate: conductor, framing };
      } else {
        const candidate: Candidate = {
          kind: 'wide',
          id: 'wide',
          group: null,
          side: null,
          seats: [],
          part: null,
          score: 0,
          entering: [],
          tier: TIERS.other,
        };
        chosen = { candidate, framing: wideFraming(planner) };
      }
    }
    const { candidate, framing } = chosen;
    const previous = planner.planned.at(-1);
    const end = Math.min(
      chooseEnd(planner, cut, candidate.kind, Infinity, candidate.seats),
      planner.lastStart,
    );
    addShot(planner, candidate, framing, {
      startSec: cut,
      endSec: end,
      moveEndSec: end,
      blendSec: previous
        ? blendOf(planner, previous, framing, candidate.kind, window, cut, end)
        : 0,
    });
    cut = end;
  }

  // The closing: the camera cranes up from the low wide view into the default view, and it holds
  // after the song end. A pull-out reverses the push-in of the shot before it.
  const to = defaultKey(1);
  const low = lowered(DEFAULT_TARGET, farDistance(planner.stageSide, true, 1), DEFAULT_ELEVATION);
  addShot(
    planner,
    { kind: 'wide', id: 'wide', group: null },
    {
      target: DEFAULT_TARGET,
      halfHeight: 0,
      from: { ...to, elevation: low },
      to,
      seats: [],
      part: null,
      held: new Set(),
      composition: null,
    },
    {
      startSec: cut,
      endSec: Infinity,
      moveEndSec: Math.max(score.durationSec, cut + SHOT_TIMES.minSec),
      blendSec: 0,
    },
  );
  if (trace) {
    trace.cut = null;
    trace.attempt = null;
  }
  const shots = planner.planned.map((p) => p.shot);
  // The held view of each seat for the camera menu (design 2.5): a section shot of the seat,
  // planned with no shot before it, so that no rule of the cuts refuses its camera.
  planner.planned.length = 0;
  planner.lastAzimuth.clear();
  planner.cut = 0;
  const window = musicIn(music, 0, SHOT_TIMES.choiceWindowSec);
  const seatViews: (Shot | null)[] = score.seats.map(() => null);
  for (const seat of planner.staged) {
    yield;
    const view = (kind: 'section' | 'solo'): Framing | null =>
      framingOf(
        planner,
        {
          kind,
          id: `view ${seat}`,
          group: null,
          side: null,
          seats: [seat],
          part: null,
          score: 0,
          entering: [],
          tier: TIERS.other,
        },
        window,
      );
    const framing = view('section') ?? view('solo');
    if (framing) {
      seatViews[seat] = {
        kind: 'section',
        startSec: -Infinity,
        endSec: Infinity,
        moveEndSec: Math.max(score.durationSec, SHOT_TIMES.minSec),
        blendSec: 0,
        seats: framing.seats,
        part: framing.part,
        target: framing.target,
        halfHeight: framing.halfHeight,
        composition: framing.composition,
        from: framing.from,
        to: framing.to,
      };
    }
  }
  return {
    stageSide: layout.stageSide,
    shots,
    starts: Float64Array.from(shots, (s) => s.startSec),
    seatViews,
  };
}

/**
 * Gives the plan of the held view of one seat (design 2.5): its one shot from
 * `ShotPlan.seatViews`, for `cameraAt()`.
 *
 * @param plan The shots of the score.
 * @param seat The seat.
 * @returns The plan, or `null` for a seat with no view.
 */
export function seatViewPlan(plan: ShotPlan, seat: number): ShotPlan | null {
  const shot = plan.seatViews?.[seat];
  if (!shot) {
    return null;
  }
  return { stageSide: plan.stageSide, shots: [shot], starts: Float64Array.of(shot.startSec) };
}

/**
 * Calculates the shots of a score (design 5.6): the cut points, the subjects, and the clear
 * cameras. Pure: the same score, layout, and seed give the same plan.
 *
 * - The first shot is the default view from `-Infinity`. It holds for the count-in, and it cranes
 *   down and pushes in over the first phrase.
 * - Each cut falls on a downbeat. A shot lasts 4 to 14 s, and a wide or high shot up to 18 s.
 * - The music after each cut selects its subject.
 * - The last shot is a wide shot that cranes up into the default view, and it holds after the song
 *   end.
 *
 * @param score The score.
 * @param layout The layout of the score, from `layoutScene()`.
 * @param seed The seed of the plan.
 * @param models The player models of the score, which the layout shares. A new cache by default.
 * @returns The plan for `cameraAt()`.
 */
export function prepareShots(
  score: Score,
  layout: SceneLayout,
  seed: number,
  models = new ModelCache(),
): ShotPlan {
  return runAll(planShotsSteps(score, layout, seed, models, null));
}

/**
 * Calculates the shots of a score as {@link prepareShots} does, in steps (design 7.2).
 *
 * @param score The score.
 * @param layout The layout of the score, from `layoutScene()`.
 * @param seed The seed of the plan.
 * @param models The player models of the score, which the layout shares.
 * @returns The steps, which return the plan for `cameraAt()`.
 */
export function prepareShotsSteps(
  score: Score,
  layout: SceneLayout,
  seed: number,
  models: ModelCache,
): Steps<ShotPlan> {
  return planShotsSteps(score, layout, seed, models, null);
}

/**
 * Calculates the shots of a score as {@link prepareShots} does, with the choice at each cut of a
 * range (design 5.6). Pure: the same inputs give the same trace.
 *
 * - The plan is the same as the plan of {@link prepareShots}.
 * - The trace holds each cut from the start to the end of the range, with both ends, in the order
 *   of the cuts. A cut at which the previous shot holds on is a cut too.
 * - Each cut gives the candidates that the rules of the choice drop, each with its rule, and the
 *   other candidates in the order of the search, with their scores and ranks.
 * - Each try of a candidate in an elevation band gives its searches, and each search gives each
 *   tested camera with its refusal. A refusal by the distance gives the largest share of the
 *   default distance, above {@link CLOSE_DISTANCE_SHARE}.
 * - A camera that failed a test at an earlier cut keeps the refusal of that test, so the trace of a
 *   cut does not depend on the range.
 *
 * @param score The score.
 * @param layout The layout of the score, from `layoutScene()`.
 * @param seed The seed of the plan.
 * @param range The range of the traced cuts, in song seconds.
 * @param models The player models of the score, which the layout shares. A new cache by default.
 * @returns The plan and the trace of each cut of the range.
 */
export function traceShots(
  score: Score,
  layout: SceneLayout,
  seed: number,
  range: TraceRange,
  models = new ModelCache(),
): ShotTrace {
  const sink: TraceSink = { range, cuts: [], kept: new Map(), cut: null, attempt: null };
  const plan = runAll(planShotsSteps(score, layout, seed, models, sink));
  return { plan, cuts: sink.cuts };
}
