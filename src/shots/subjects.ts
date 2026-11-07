import { CONDUCTOR } from '../models/cast.ts';
import type { PlayingSection } from '../models/cast.ts';
import { footprintOf, placeFootprint, playerFootprint } from '../models/footprint.ts';
import type { PlacedBox } from '../models/footprint.ts';
import type { Bounds } from '../models/bounds.ts';
import { placePoint } from '../models/instruments/hold.ts';
import type { ConductorPlace, PlayerPlace, SceneLayout } from '../models/layout.ts';
import type { ModelCache } from '../models/model-cache.ts';
import type { PlayerModel } from '../models/player.ts';
import type { Vec3 } from '../models/tuples.ts';
import { boneIndex } from '../models/rig.ts';
import { conductorBeatPoint } from '../pose/conductor.ts';
import { headOf } from '../pose/plan.ts';
import type { Score } from '../score/types.ts';
import { angleDifference, azimuthOf } from './camera-keys.ts';
import { CONDUCTOR_OWNER } from './clearance.ts';
import type { SightPoints } from './clearance.ts';
import type { BodyPart, StageBody, StageHead } from './foreground.ts';

/**
 * The groups of the section shots (design 5.6). `ensemble` is the two-shot of all players of a
 * group with fewer than 3 seats.
 */
export type SectionGroup =
  | 'violins'
  | 'low-strings'
  | 'woodwinds'
  | 'brass'
  | 'percussion'
  | 'harp'
  | 'piano'
  | 'choir'
  | 'ensemble';

/** The group of each section (design 5.6). */
export const SECTION_GROUPS = {
  violin: 'violins',
  viola: 'low-strings',
  cello: 'low-strings',
  contrabass: 'low-strings',
  harp: 'harp',
  piano: 'piano',
  flute: 'woodwinds',
  oboe: 'woodwinds',
  clarinet: 'woodwinds',
  bassoon: 'woodwinds',
  horn: 'brass',
  trumpet: 'brass',
  trombone: 'brass',
  tuba: 'brass',
  timpani: 'percussion',
  percussion: 'percussion',
  choir: 'choir',
} as const satisfies Readonly<Record<PlayingSection, SectionGroup>>;

/** The sizes of the subjects of the shots (design 5.6). */
export const SUBJECT_SIZES = {
  /** The target of a section shot is this high above the players. */
  sectionHeight: 0.8,
  /**
   * The sphere of a section holds each player plus this margin in the stage plane. The sphere
   * chooses the players of the shot, and the outline of the players sets the frame.
   */
  sectionMargin: 0.75,
  /** The sphere of the two-shot of a small group holds each player plus this margin. */
  twoShotMargin: 0.46,
  /** The largest sphere of a section shot. */
  sectionMaxRadius: 2.6,
  /**
   * The sphere of a choir part also holds this margin beyond the section margin: the place of
   * one more singer on each side (design 4.5).
   */
  partMargin: 0.6,
  /** The target of a solo shot is this high above the principal player. */
  soloHeight: 0.9,
  /**
   * The target of the close view of the conductor from behind (view 05 of `scene.png`) is this
   * far below the middle of the head of the bear: at its shoulders. The frame holds the head, the
   * raised arms, and the back.
   */
  conductorDrop: 0.3,
  /**
   * The target of the view over the shoulder of the conductor (view 02 of `scene.png`) is this
   * many stage sides in front of the head of the bear, toward the players who play, and this
   * high above the stage top. The camera thus looks over the bear at the middle of the
   * orchestra.
   */
  conductorBackReach: 0.4,
  conductorBackHeight: 1.0,
  /**
   * The line from the bear to the target turns at most this far from the line to the back of the
   * stage, in radians: 20°. Thus the camera stays behind the bear, also when only the players at
   * one side play.
   */
  conductorBackTurn: (20 * Math.PI) / 180,
  /** The sphere of the view over the shoulder, in stage sides: the orchestra behind the bear. */
  conductorBackRadius: 0.3,
  /** The sphere of a section also holds each head point plus this margin. */
  headMargin: 0.3,
  /** The middle of the body of the bear is this high above the podium top. */
  conductorBodyHeight: 0.8,
  /**
   * The side views (views 03 and 04 of `scene.png`): the target is this high above the stage
   * top, and at least this many stage sides from the middle line of the stage, on its side.
   */
  sideHeight: 1.0,
  sideReach: 0.15,
  /** The sphere of a side view, in stage sides: about the front half of one side of the stage. */
  sideRadius: 0.27,
  /** The front of the left side view, in radians: 50° to the left of the audience axis. */
  sideFront: (50 * Math.PI) / 180,
  /**
   * The outline of a player holds its footprint up to this distance from its place, in meters:
   * the body, a held instrument, and the near part of a piano, a harp, or the kettles. The
   * kettles of the timpani reach 1.5 m to the side.
   */
  outlineReach: 0.9,
} as const;

/** One player of a seat: its place, the point of its head, its front, and its sight points. */
interface SubjectPlayer {
  /** The number of the player in its seat: 0 is the principal player. */
  readonly player: number;
  /** The place of the player on the stage top or on its riser. */
  readonly position: Vec3;
  /** The point of the `head` bone of the player in the bind pose. */
  readonly head: Vec3;
  /**
   * The point of the `chest` bone of the player in the bind pose, where a singer holds its music
   * folder (design 4.5). The skeleton of the species gives its height (design 4.3).
   */
  readonly chest: Vec3;
  /** The azimuth of the front of the player: the direction that it faces. */
  readonly front: number;
  /**
   * The points that a close camera must see: the middle of the head, then the hands and the
   * instrument (design 5.6).
   */
  readonly sights: SightPoints;
  /**
   * The corners of the outline of the player in the stage plane: its body, its instrument, and
   * its seat, up to {@link SUBJECT_SIZES}.outlineReach from its place (design 5.6). The frame of a
   * close shot holds their spread across the view.
   */
  readonly outline: readonly Vec3[];
  /** The height of the top of the head of the player with no ears, in meters. */
  readonly top: number;
  /** The eyes of the player and the boxes of its own instrument, for the face test. */
  readonly face: SubjectFace;
}

/**
 * The face of a subject player for the face test of a close shot (design 5.6): the middle of its
 * eyes, and the boxes of its own instrument, which must not hide them. The line of sight to the
 * head skips each box of its owner, because a box of the head band holds the head, so the bell of
 * a tuba in front of the face passed it.
 */
export interface SubjectFace {
  readonly eyes: Vec3;
  readonly shield: readonly PlacedBox[];
}

/** The height of one band of the boxes of an instrument for the face test, in meters. */
const SHIELD_BAND = 0.04;

/** The boxes of the instrument of each player model, in the axes of the model. */
const shields = new WeakMap<PlayerModel, readonly Bounds[]>();

/**
 * Gives the boxes of the instrument of a player model in its bind pose: one box for each band of
 * {@link SHIELD_BAND} of height, so that a box of a horizontal tube stays thin.
 *
 * @param model The player model.
 * @returns The boxes.
 */
function shieldOf(model: PlayerModel): readonly Bounds[] {
  const known = shields.get(model);
  if (known) {
    return known;
  }
  const bone = boneIndex('instrument');
  const { positions, bones } = model.mesh;
  const bands = new Map<number, { min: [number, number, number]; max: [number, number, number] }>();
  for (let t = 0; t < positions.length / 9; t++) {
    if (bones[t * 3] !== bone) {
      continue;
    }
    // Each triangle goes into the band of its middle with all its corners, and each box fills its
    // band, so that the boxes of a tube or a bell join with no gap between the bands.
    const middle =
      ((positions[t * 9 + 1] ?? 0) + (positions[t * 9 + 4] ?? 0) + (positions[t * 9 + 7] ?? 0)) / 3;
    const key = Math.floor(middle / SHIELD_BAND);
    for (let v = 0; v < 3; v++) {
      const x = positions[t * 9 + v * 3] ?? 0;
      const y = positions[t * 9 + v * 3 + 1] ?? 0;
      const z = positions[t * 9 + v * 3 + 2] ?? 0;
      const box = bands.get(key) ?? {
        min: [x, key * SHIELD_BAND, z],
        max: [x, (key + 1) * SHIELD_BAND, z],
      };
      box.min = [Math.min(box.min[0], x), Math.min(box.min[1], y), Math.min(box.min[2], z)];
      box.max = [Math.max(box.max[0], x), Math.max(box.max[1], y), Math.max(box.max[2], z)];
      bands.set(key, box);
    }
  }
  const boxes = [...bands.values()].map((b): Bounds => ({ min: b.min, max: b.max }));
  shields.set(model, boxes);
  return boxes;
}

/**
 * Gives the face of a player on the stage ({@link SubjectFace}).
 *
 * @param model The player model.
 * @param place The place of the player.
 * @returns The face.
 */
function faceOf(model: PlayerModel, place: PlayerPlace): SubjectFace {
  const eye = (name: 'eyeL' | 'eyeR'): Vec3 =>
    model.skeleton.positions[boneIndex(name)] ?? model.body.headCenter;
  const [l, r] = [eye('eyeL'), eye('eyeR')];
  const middle: Vec3 = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2];
  const boxes = shieldOf(model);
  return {
    eyes: onStage(middle, place),
    shield:
      boxes.length > 0 ? placeFootprint(footprintOf(boxes), place.position, place.facing) : [],
  };
}

/** The players of one seat. */
interface SeatPlayers {
  /** The group of the section shots of the seat. */
  readonly group: SectionGroup;
  /** The players in the order of the layout. The first one is the principal player. */
  readonly players: readonly SubjectPlayer[];
}

/** The places of the conductor that the shots read. */
interface ConductorSubjects {
  /** The target of the close view of the conductor: the shoulders of the bear. */
  readonly target: Vec3;
  /** The sight points of the conductor: its head and the beat points of its two hands. */
  readonly sights: SightPoints;
  /** The middle of the body of the bear, 0.8 m above the podium top. */
  readonly body: Vec3;
  /** The corners of the outline of the bear and its two hands in the stage plane. */
  readonly outline: readonly Vec3[];
  /** The height of the top of the head of the bear with no ears, in meters. */
  readonly top: number;
}

/** The places of the subjects of a layout. */
export interface StageSubjects {
  readonly stageSide: number;
  readonly podium: Vec3;
  /** One entry for each seat, or `null` for a seat with no players on the stage. */
  readonly seats: readonly (SeatPlayers | null)[];
  /** The conductor, or `null` for a chamber group with no conductor (design 4.2). */
  readonly conductor: ConductorSubjects | null;
  /** The heads of all players and of the conductor, for the foreground rule. */
  readonly heads: readonly StageHead[];
  /** The seat of the soloist of the score (3.8), or `null`. */
  readonly soloist: number | null;
}

/** The subject of a shot: the target, the extent that the frame holds, and the front. */
export interface Subject {
  /** The point that the camera looks at. */
  readonly target: Vec3;
  /** The azimuth of the front of the subject. A camera stays within 75° of it. */
  readonly front: number;
  /**
   * The azimuth to which the subject players face, for the screen direction of their look (design
   * 5.6). It differs from {@link Subject.front} for the piano, whose camera stands at the side.
   */
  readonly facing: number;
  /** The middle of the subject players on the stage, for the screen direction of their look. */
  readonly center: Vec3;
  /**
   * The middle of the heads of the subject players, which the frame puts on the upper third line
   * (design 5.6), or `null` for a subject in the middle of the frame.
   */
  readonly eyes: Vec3 | null;
  /** 0 at the podium, 1 at the back edge of the stage (design 5.6). */
  readonly back: number;
  /** The seats of the subject. */
  readonly seats: readonly number[];
  /** The players of a choir part by their number in the seat, or `null` for all players. */
  readonly part: readonly number[] | null;
  /** The sight points of a solo or a conductor shot. A section shot has none. */
  readonly sights: SightPoints | null;
  /** The elevation that the shot adds to its kind, in radians: 0, or more for the piano. */
  readonly lift: number;
  /**
   * The factor of the seeded offset of the azimuth from the front: 1, or less for the piano, so
   * that its camera stays near the side view.
   */
  readonly spread: number;
  /** The owners of the heads of the subject players, which the foreground rule skips. */
  readonly members: readonly number[];
  /**
   * The point that sets the distance of the foreground rule: the middle of the head of a solo
   * player or of the conductor, or the target of a section.
   */
  readonly focus: Vec3;
  /**
   * A point that stays out of the frame of a desktop view, or `null`: the middle of the body of
   * the bear in a solo shot of the soloist, who stands beside the podium (design 5.6).
   */
  readonly outside: Vec3 | null;
  /**
   * The chests of the singers of a choir subject, or none for the other subjects. A head of
   * another player under them on the screen does not cover a singer (design 5.6).
   */
  readonly floor: readonly Vec3[];
  /** The faces of the subject players, for the face test of a close shot (design 5.6). */
  readonly faces: readonly SubjectFace[];
  /**
   * The points in the stage plane whose spread across the view sets the width of the frame
   * (design 5.6): the outline of the subject players, or the middle of the sphere of a side view
   * or of the view over the shoulder.
   */
  readonly outline: readonly Vec3[];
  /**
   * The radius of a circle around each point of the outline, in meters: 0 for the outline of the
   * players, or the sphere of a side view or of the view over the shoulder.
   */
  readonly reach: number;
  /**
   * The tops of the heads of the subject players with no ears, over the middle of each head.
   * The frame holds them below its top edge.
   */
  readonly tops: readonly Vec3[];
  /**
   * The low points that the frame holds above its bottom edge: the hands and the instruments of
   * the subject players and the target, or the middle of the body of the conductor.
   */
  readonly lows: readonly Vec3[];
}

/** The radius of the sphere around a head, in head heights `H`. It holds the snout. */
const HEAD_RADIUS_IN_H = 0.6;

/**
 * The view of the piano (design 5.6). The case stands in front of the pianist, so a camera in front
 * of the player looked into the black case, and the hands did not show. The camera of a piano shot
 * stands on the right of the pianist, the side of the high keys and of the open lid, and higher.
 */
const KEYBOARD_VIEW = {
  /**
   * The front of a piano subject turns this far from the front of the pianist, to its right: the
   * profile of the pianist over the high keys. With a turn of 100° and the full offset of a solo
   * shot, the camera of the Boulanger piano solo stood 128° from the front of the pianist and
   * showed its back.
   */
  turn: (-88 * Math.PI) / 180,
  /** A piano shot adds this elevation, in radians. */
  lift: (20 * Math.PI) / 180,
  /** The factor of the seeded offset of a piano shot. */
  spread: 0.25,
} as const;

/**
 * Gives the azimuth of the front of a place: the direction `(-sin f, 0, -cos f)` of its facing.
 *
 * @param facing The facing, in radians around y. 0 faces -z.
 * @returns The azimuth, in radians from +z to +x.
 */
function frontOf(facing: number): number {
  return azimuthOf(-Math.sin(facing), -Math.cos(facing));
}

/**
 * Moves a point of the model axes to its place on the stage: a turn of `facing` around y, then
 * the position.
 *
 * @param point The point in the model axes.
 * @param place The place of the model.
 * @returns The point on the stage.
 */
function onStage(point: Vec3, place: Pick<PlayerPlace, 'position' | 'facing'>): Vec3 {
  const cos = Math.cos(place.facing);
  const sin = Math.sin(place.facing);
  return [
    place.position[0] + point[0] * cos + point[2] * sin,
    place.position[1] + point[1],
    place.position[2] - point[0] * sin + point[2] * cos,
  ];
}

/**
 * Gives the z component of the cross product of two edges in the stage plane: from `o` to `a`
 * and from `o` to `b`.
 *
 * @param o The common start.
 * @param a The end of the first edge.
 * @param b The end of the second edge.
 * @returns More than 0 for a turn from +x to +z.
 */
function turnOf(o: Vec3, a: Vec3, b: Vec3): number {
  return (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
}

/**
 * Gives the convex hull of points in the stage plane (the monotone chain). The spread of the
 * points across a view is the spread of their hull, which has fewer points.
 *
 * @param points The points. Their y does not count.
 * @returns The corners of the hull, with the y 0.
 */
function hullOf(points: readonly Vec3[]): Vec3[] {
  const sorted = points
    .map((p): Vec3 => [p[0], 0, p[2]])
    .toSorted((a, b) => a[0] - b[0] || a[2] - b[2]);
  if (sorted.length < 3) {
    return sorted;
  }

  const chain = (list: readonly Vec3[]): Vec3[] => {
    const out: Vec3[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        turnOf(out[out.length - 2] ?? p, out[out.length - 1] ?? p, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain(sorted.toReversed())];
}

/**
 * The bones of the head whose top the frame of a close shot holds below its top edge (design 5.6):
 * the skull and the face. The ears do not count, because a closer shot needs less headroom and a
 * close shot can cut the top of the head (`docs/reference/camera-technique.md`). With the ears, a
 * waist shot of a rabbit was about 4 m wide and showed about seven players.
 */
export const HEAD_BONES: ReadonlySet<number> = new Set(
  (['head', 'jaw'] as const).map((name) => boneIndex(name)),
);

/** The height of the top of the head of each model, in the model axes. */
const headTops = new WeakMap<PlayerModel, number>();

/**
 * Gives the height of the top of the head of a model with no ears, in the model axes: the highest
 * corner of the mesh on a bone of {@link HEAD_BONES}. An instrument, such as the lid of the piano,
 * does not count.
 *
 * @param model The model.
 * @returns The height, in meters.
 */
function headTopOf(model: PlayerModel): number {
  const known = headTops.get(model);
  if (known !== undefined) {
    return known;
  }

  const { positions, bones } = model.mesh;
  let top = model.body.headCenter[1];
  for (let corner = 0; corner < bones.length; corner++) {
    if (HEAD_BONES.has(bones[corner] ?? -1)) {
      top = Math.max(top, positions[corner * 3 + 1] ?? top);
    }
  }
  headTops.set(model, top);
  return top;
}

/** The size of the cells of the grid that groups the points of a body into parts, in meters. */
const BODY_PART_CELL = 0.25;

/** The points of the body of a model in the model axes, grouped into parts. */
interface ModelBody {
  /** The points, as x, y, z, in the order of the parts. */
  readonly points: Float64Array;
  /** The middle of a sphere that holds the points. */
  readonly center: Vec3;
  /** The radius of the sphere, in meters. */
  readonly radius: number;
  /** The parts, in the model axes. */
  readonly parts: readonly BodyPart[];
}

/** The body of each model, in the model axes. */
const modelBodies = new WeakMap<PlayerModel, ModelBody>();

/**
 * Gives the body of a model in the model axes (design 5.6): the corners of the mesh on a bone of
 * the body, with no repeats, grouped into the parts of a grid of {@link BODY_PART_CELL}. A bone of
 * the instrument, such as `instrument` or `bow`, does not count.
 *
 * @param model The model.
 * @returns The body.
 */
function modelBodyOf(model: PlayerModel): ModelBody {
  const known = modelBodies.get(model);
  if (known) {
    return known;
  }

  const { positions, bones } = model.mesh;
  const instrument = boneIndex('instrument');
  const c = BODY_PART_CELL;
  // The corners of a triangle mesh repeat each point as an exact copy, so a hash table of the bits
  // of the three floats finds each repeat with no rounding.
  const bits = new Int32Array(positions.buffer, positions.byteOffset, positions.length);
  const size = 2 ** Math.ceil(Math.log2(2 * bones.length + 2));
  const table = new Int32Array(size).fill(-1);
  const cells = new Map<number, number[]>();
  for (let corner = 0; corner < bones.length; corner++) {
    if ((bones[corner] ?? 0) >= instrument) {
      continue;
    }
    const [a, b, d] = [bits[corner * 3] ?? 0, bits[corner * 3 + 1] ?? 0, bits[corner * 3 + 2] ?? 0];
    let slot =
      (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(d, 0xc2b2ae3d)) & (size - 1);
    let repeat = false;
    for (let other = table[slot] ?? -1; other >= 0; other = table[slot] ?? -1) {
      if (bits[other * 3] === a && bits[other * 3 + 1] === b && bits[other * 3 + 2] === d) {
        repeat = true;
        break;
      }
      slot = (slot + 1) & (size - 1);
    }
    if (repeat) {
      continue;
    }
    table[slot] = corner;
    const x = positions[corner * 3] ?? 0;
    const y = positions[corner * 3 + 1] ?? 0;
    const z = positions[corner * 3 + 2] ?? 0;
    // 8 bits for each axis of the cell: a model within ±32 m.
    const cell =
      ((Math.floor(x / c) + 128) * 256 + Math.floor(y / c) + 128) * 256 + Math.floor(z / c) + 128;
    const list = cells.get(cell) ?? [];
    list.push(x, y, z);
    cells.set(cell, list);
  }

  const points: number[] = [];
  const parts: BodyPart[] = [];
  for (const list of cells.values()) {
    const start = points.length / 3;
    points.push(...list);
    const sphere = sphereAround(list);
    parts.push({ ...sphere, start, end: points.length / 3 });
  }
  const body = { points: Float64Array.from(points), ...sphereAround(points), parts };
  modelBodies.set(model, body);
  return body;
}

/**
 * Gives a sphere that holds points: the middle of their box, and the distance to the farthest
 * point.
 *
 * @param points The points, as x, y, z.
 * @returns The middle and the radius.
 */
function sphereAround(points: ArrayLike<number>): Pick<BodyPart, 'center' | 'radius'> {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i++) {
    const k = i % 3;
    const v = points[i] ?? 0;
    low[k] = Math.min(low[k] ?? v, v);
    high[k] = Math.max(high[k] ?? v, v);
  }
  const middle = (k: number): number => ((low[k] ?? 0) + (high[k] ?? 0)) / 2;
  const center: Vec3 = [middle(0), middle(1), middle(2)];
  let radius = 0;
  for (let i = 0; i < points.length; i += 3) {
    radius = Math.max(
      radius,
      Math.hypot(
        (points[i] ?? 0) - center[0],
        (points[i + 1] ?? 0) - center[1],
        (points[i + 2] ?? 0) - center[2],
      ),
    );
  }
  return { center, radius };
}

/**
 * Gives the body of a model at its place on the stage (design 5.6): its parts after a turn of
 * `facing` around y and the position, and a sphere that holds them. The points of a part move to
 * the place at the first test of the part (`placePart()` of `foreground.ts`).
 *
 * @param model The model.
 * @param place The place of the model.
 * @returns The body.
 */
function bodyAt(model: PlayerModel, place: Pick<PlayerPlace, 'position' | 'facing'>): StageBody {
  const local = modelBodyOf(model);
  const cos = Math.cos(place.facing);
  const sin = Math.sin(place.facing);
  const [px, py, pz] = place.position;
  const move = (x: number, y: number, z: number): Vec3 => [
    px + x * cos + z * sin,
    py + y,
    pz - x * sin + z * cos,
  ];
  // A turn and a move keep each sphere: only its middle moves.
  const parts = local.parts.map((part) => ({ ...part, center: move(...part.center) }));
  return {
    local: local.points,
    points: new Float64Array(local.points.length),
    placed: new Uint8Array(local.points.length / 3),
    position: place.position,
    cos,
    sin,
    center: move(...local.center),
    radius: local.radius,
    parts,
  };
}

/** The outline of a model in the stage plane, and the height of its top. */
interface PlayerOutline {
  /** The corners of the outline. */
  readonly outline: Vec3[];
  /** The height of the top of the head with no ears, in meters. */
  readonly top: number;
}

/**
 * Gives the outline of a model at its place (design 5.6): the hull of the corners of its
 * footprint boxes and of some other points, each moved toward the place to at most
 * {@link SUBJECT_SIZES}.outlineReach from it.
 *
 * @param model The model.
 * @param place The place of the model.
 * @param others Other points on the stage, such as the hands of the conductor.
 * @returns The corners of the outline, and the height of the top of the head.
 */
function outlineOf(
  model: PlayerModel,
  place: Pick<PlayerPlace, 'position' | 'facing'>,
  others: readonly Vec3[] = [],
): PlayerOutline {
  const footprint = playerFootprint(model);
  const points: Vec3[] = [...others];
  for (const box of footprint.boxes) {
    for (const x of [box.min[0], box.max[0]]) {
      for (const z of [box.min[2], box.max[2]]) {
        points.push(onStage([x, 0, z], place));
      }
    }
  }
  const [px, , pz] = place.position;
  const reach = SUBJECT_SIZES.outlineReach;
  const near = points.map((p): Vec3 => {
    const flat = Math.hypot(p[0] - px, p[2] - pz);
    const scale = flat > reach ? reach / flat : 1;
    return [px + (p[0] - px) * scale, 0, pz + (p[2] - pz) * scale];
  });
  return { outline: hullOf(near), top: place.position[1] + headTopOf(model) };
}

/**
 * Finds the sight points of a player in the model axes (design 5.6): the middle of the head, each
 * palm that holds the instrument in the playing pose, and one point of the instrument. That point
 * is the middle of the first play target on the instrument, such as the bow contact, the keys,
 * or the harp strings, or else the mouthpiece. A palm on the bow or on a mallet hangs in the bind
 * pose, so it does not count.
 *
 * @param model The player model.
 * @returns The head, then the other points.
 */
function modelSights(model: PlayerModel): Omit<SightPoints, 'owner'> {
  const { grips, targets } = model.instrument;
  const parts: Vec3[] = [];
  for (const palm of [grips.palmL, grips.palmR]) {
    if (palm?.bone === 'instrument') {
      parts.push(placePoint(model.pieces, palm));
    }
  }
  const target = targets.find((t) => t.bone === 'instrument');
  if (target) {
    const a = placePoint(model.pieces, { bone: target.bone, at: target.from });
    const b = placePoint(model.pieces, { bone: target.bone, at: target.to });
    parts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  } else if (grips.mouth?.bone === 'instrument') {
    parts.push(placePoint(model.pieces, grips.mouth));
  }
  return { head: model.body.headCenter, parts };
}

/**
 * Finds the sight points of the conductor (design 5.6): the middle of the head, and the point of
 * beat 1 of the baton (5.4) with its mirror for the left hand.
 *
 * @param model The bear with the baton.
 * @param place The place of the conductor.
 * @returns The sight points on the stage.
 */
function conductorSights(model: PlayerModel, place: ConductorPlace): SightPoints {
  const beat = conductorBeatPoint(model);
  return {
    owner: CONDUCTOR_OWNER,
    head: onStage(model.body.headCenter, place),
    parts: [onStage(beat, place), onStage([-beat[0], beat[1], beat[2]], place)],
  };
}

/**
 * Prepares the places of the subjects of a layout: the players of each seat with their heads and
 * fronts, and the head of the conductor.
 *
 * @param score The score.
 * @param layout The layout of the score.
 * @param models The player models of the score.
 * @returns The subjects.
 */
export function prepareSubjects(
  score: Score,
  layout: SceneLayout,
  models: ModelCache,
): StageSubjects {
  const bySeat = score.seats.map((): { place: PlayerPlace; index: number }[] => []);
  for (const [index, place] of layout.players.entries()) {
    bySeat[place.cast.seatIndex]?.push({ place, index });
  }
  const heads: StageHead[] = [];
  const seats = score.seats.map((seat, i): SeatPlayers | null => {
    const places = bySeat[i] ?? [];
    if (seat.section === 'sound-only' || places.length === 0) {
      return null;
    }
    return {
      group: SECTION_GROUPS[seat.section],
      players: places.map(({ place, index }) => {
        const { species, instrument, kettles, support } = place.cast;
        const model = models.get(species, instrument, kettles, support);
        const sights = modelSights(model);
        const center = onStage(sights.head, place);
        heads.push({ owner: index, center, radius: HEAD_RADIUS_IN_H * model.body.headHeight });
        const { outline, top } = outlineOf(model, place);

        return {
          player: place.cast.player,
          position: place.position,
          head: headOf(model, place),
          chest: onStage(model.body.positions.chest, place),
          front: frontOf(place.facing),
          sights: {
            owner: index,
            head: center,
            parts: sights.parts.map((p) => onStage(p, place)),
          },
          outline,
          top,
          face: faceOf(model, place),
        };
      }),
    };
  });
  let conductor: ConductorSubjects | null = null;
  if (layout.conductor) {
    const bear = models.get(CONDUCTOR.species, CONDUCTOR.instrument);
    const place = layout.conductor;
    const sights = conductorSights(bear, place);
    heads.push({
      owner: CONDUCTOR_OWNER,
      center: sights.head,
      radius: HEAD_RADIUS_IN_H * bear.body.headHeight,
    });
    conductor = {
      target: [sights.head[0], sights.head[1] - SUBJECT_SIZES.conductorDrop, sights.head[2]],
      sights,
      body: [
        place.position[0],
        place.position[1] + SUBJECT_SIZES.conductorBodyHeight,
        place.position[2],
      ],
      ...outlineOf(bear, place, sights.parts),
    };
  }
  return {
    stageSide: layout.stageSide,
    podium: layout.podium,
    seats,
    conductor,
    heads,
    soloist: score.soloist,
  };
}

/**
 * Prepares the body of each animal of a layout (design 5.6): each player and the conductor in the
 * bind pose, for the distance floor of a close shot.
 *
 * @param layout The layout of the score.
 * @param models The player models of the score.
 * @returns The bodies.
 */
export function prepareBodies(layout: SceneLayout, models: ModelCache): StageBody[] {
  const bodies = layout.players.map((place) => {
    const { species, instrument, kettles, support } = place.cast;
    return bodyAt(models.get(species, instrument, kettles, support), place);
  });
  if (layout.conductor) {
    bodies.push(bodyAt(models.get(CONDUCTOR.species, CONDUCTOR.instrument), layout.conductor));
  }
  return bodies;
}

/**
 * Calculates the back value of a target: 0 at the podium and 1 at the back edge of the stage
 * (design 5.6). A back row gets a higher camera, which looks over the front rows.
 *
 * @param subjects The subjects.
 * @param z The z of the target.
 * @returns The back value, from 0 to 1.
 */
function backOf(subjects: StageSubjects, z: number): number {
  const podiumZ = subjects.podium[2];
  const value = (podiumZ - z) / (podiumZ + subjects.stageSide / 2);
  return Math.min(1, Math.max(0, value));
}

/**
 * Calculates the distance between two points.
 *
 * @param a A point.
 * @param b Another point.
 * @returns The distance.
 */
function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** A sphere around players. */
interface PlayerSphere {
  readonly target: Vec3;
  readonly radius: number;
}

/**
 * Calculates the sphere of a section shot around players (design 5.6): the target 0.8 m above
 * their middle, and the radius that holds each player plus 0.75 m and each head.
 *
 * @param players The players. There is at least one.
 * @param margin The margin around each player in the stage plane: `SUBJECT_SIZES.sectionMargin`,
 *   or `SUBJECT_SIZES.twoShotMargin` for a two-shot.
 * @returns The sphere.
 */
function sphereOf(players: readonly SubjectPlayer[], margin: number): PlayerSphere {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of players) {
    x += p.position[0];
    y += p.position[1];
    z += p.position[2];
  }
  const n = players.length;
  const target: Vec3 = [x / n, y / n + SUBJECT_SIZES.sectionHeight, z / n];
  let radius = 0;
  for (const p of players) {
    const flat = Math.hypot(p.position[0] - target[0], p.position[2] - target[2]);
    radius = Math.max(radius, flat + margin, distance(p.head, target) + SUBJECT_SIZES.headMargin);
  }
  return { target, radius };
}

/**
 * Gives the azimuth of the mean front of players.
 *
 * @param players The players.
 * @returns The azimuth, in radians.
 */
function meanFront(players: readonly SubjectPlayer[]): number {
  let x = 0;
  let z = 0;
  for (const p of players) {
    x += Math.sin(p.front);
    z += Math.cos(p.front);
  }
  return azimuthOf(x, z);
}

/**
 * Gives the middle of the places of players.
 *
 * @param players The players. There is at least one.
 * @returns The middle.
 */
function middleOf(players: readonly SubjectPlayer[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of players) {
    x += p.position[0];
    y += p.position[1];
    z += p.position[2];
  }
  const n = players.length;
  return [x / n, y / n, z / n];
}

/**
 * Gives the middle of the heads of players.
 *
 * @param players The players. There is at least one.
 * @returns The middle.
 */
function headsOf(players: readonly SubjectPlayer[]): Vec3 {
  return middleOf(players.map((p) => ({ ...p, position: p.sights.head })));
}

/**
 * Gives the extent of players that the frame of a close shot holds (design 5.6): the hull of
 * their outlines, the top of each head, and their hands, their instruments, and a target.
 *
 * @param players The players. There is at least one.
 * @param target The target of the shot.
 * @returns The outline, the tops, and the low points of the subject.
 */
function extentOf(
  players: readonly SubjectPlayer[],
  target: Vec3,
): Pick<Subject, 'outline' | 'reach' | 'tops' | 'lows' | 'faces'> {
  return {
    faces: players.map((p) => p.face),
    outline: hullOf(players.flatMap((p) => p.outline)),
    reach: 0,
    tops: players.map((p): Vec3 => [p.sights.head[0], p.top, p.sights.head[2]]),
    lows: [target, ...players.flatMap((p) => p.sights.parts)],
  };
}

/**
 * Gives the subject of a solo shot (design 5.6): the principal player of a seat, with the target
 * 0.9 m above the stage. The frame holds the outline of the player, its head, and its hands.
 *
 * @param subjects The subjects.
 * @param seatIndex The seat.
 * @returns The subject, or `null` for a seat with no players.
 */
export function soloSubject(subjects: StageSubjects, seatIndex: number): Subject | null {
  const principal = subjects.seats[seatIndex]?.players[0];
  if (!principal) {
    return null;
  }
  const [x, y, z] = principal.position;
  const target: Vec3 = [x, y + SUBJECT_SIZES.soloHeight, z];
  const piano = subjects.seats[seatIndex]?.group === 'piano';
  return {
    target,
    front: piano ? principal.front + KEYBOARD_VIEW.turn : principal.front,
    facing: principal.front,
    center: principal.position,
    eyes: principal.sights.head,
    back: backOf(subjects, z),
    seats: [seatIndex],
    part: null,
    sights: principal.sights,
    lift: piano ? KEYBOARD_VIEW.lift : 0,
    spread: piano ? KEYBOARD_VIEW.spread : 1,
    members: [principal.sights.owner],
    focus: principal.sights.head,
    outside: seatIndex === subjects.soloist ? (subjects.conductor?.body ?? null) : null,
    floor: [],
    ...extentOf([principal], target),
  };
}

/**
 * Gives the subject of a section shot (design 5.6): the players of the active seats of a group.
 * When the sphere is larger than 2.6 m, the shot keeps the seat with the most activity, and the
 * next seat if both still fit. When one seat alone is too large, the shot keeps the players
 * nearest to its principal player.
 *
 * A choir subject films the singers over the orchestra. All singers of its seats are subject
 * players, and the chests of the singers in the sphere are its floor. A part shot holds only the
 * players of one part of one choir seat, for example the sopranos, and its sphere holds the
 * place of one more singer on each side.
 *
 * @param subjects The subjects.
 * @param seats The active seats of the group, with the most activity first.
 * @param margin The margin around each player in the stage plane: `SUBJECT_SIZES.sectionMargin`,
 *   or `SUBJECT_SIZES.twoShotMargin` for the two-shot of a small group.
 * @param part The players of a part of the first seat by their number in the seat, or `null`
 *   for all players.
 * @returns The subject, or `null` with no players.
 */
export function sectionSubject(
  subjects: StageSubjects,
  seats: readonly number[],
  margin: number = SUBJECT_SIZES.sectionMargin,
  part: readonly number[] | null = null,
): Subject | null {
  const playersOf = (list: readonly number[]): SubjectPlayer[] =>
    list.flatMap((s) => subjects.seats[s]?.players ?? []);
  const max = SUBJECT_SIZES.sectionMaxRadius;
  let kept: readonly number[] = part ? seats.slice(0, 1) : seats;
  let players = playersOf(kept).filter((p) => !part || part.includes(p.player));
  if (players.length === 0) {
    return null;
  }

  let sphere = sphereOf(players, part ? margin + SUBJECT_SIZES.partMargin : margin);
  if (sphere.radius > max && kept.length > 1) {
    kept = seats.slice(0, 2);
    players = playersOf(kept);
    sphere = sphereOf(players, margin);
    if (sphere.radius > max) {
      kept = seats.slice(0, 1);
      players = playersOf(kept);
      sphere = sphereOf(players, margin);
    }
  }
  if (sphere.radius > max) {
    const principal = players[0]?.position ?? [0, 0, 0];
    const sorted = players.toSorted(
      (a, b) => distance(a.position, principal) - distance(b.position, principal),
    );
    let count = 1;
    while (count < sorted.length && sphereOf(sorted.slice(0, count + 1), margin).radius <= max) {
      count++;
    }
    players = sorted.slice(0, count);
    sphere = sphereOf(players, margin);
  }

  const piano = kept.every((seat) => subjects.seats[seat]?.group === 'piano');
  const choir = kept.every((seat) => subjects.seats[seat]?.group === 'choir');
  const members = choir ? playersOf(kept) : players;
  return {
    target: sphere.target,
    front: piano ? meanFront(players) + KEYBOARD_VIEW.turn : meanFront(players),
    facing: meanFront(players),
    center: middleOf(players),
    eyes: headsOf(players),
    back: backOf(subjects, sphere.target[2]),
    seats: kept,
    part,
    sights: null,
    lift: piano ? KEYBOARD_VIEW.lift : 0,
    spread: piano ? KEYBOARD_VIEW.spread : 1,
    members: members.map((p) => p.sights.owner),
    focus: sphere.target,
    outside: null,
    floor: choir ? players.map((p) => p.chest) : [],
    ...extentOf(players, sphere.target),
  };
}

/**
 * Gives the subject of the close view of the conductor from behind (design 5.6, view 05 of
 * `scene.png`): the shoulders of the bear. The frame holds the bear and its hands from the middle
 * of its body to the top of its head. The camera stands on the
 * audience side, so the front of the subject points to +z. The baton and the hands are in front
 * of the bear, so the camera needs a clear line to the head only.
 *
 * @param conductor The places of the conductor.
 * @returns The subject.
 */
export function conductorCloseSubject(conductor: ConductorSubjects): Subject {
  const { head } = conductor.sights;
  return {
    target: conductor.target,
    front: 0,
    facing: Math.PI,
    center: head,
    eyes: head,
    back: 0,
    seats: [],
    part: null,
    sights: { owner: CONDUCTOR_OWNER, head, parts: [] },
    lift: 0,
    spread: 1,
    members: [CONDUCTOR_OWNER],
    focus: head,
    outside: null,
    floor: [],
    faces: [],
    outline: conductor.outline,
    reach: 0,
    tops: [[head[0], conductor.top, head[2]]],
    lows: [conductor.body],
  };
}

/**
 * Gives the subject of the view over the shoulder of the conductor (design 5.6, view 02 of
 * `scene.png`): the camera looks over the bear at the middle of the orchestra, toward the players
 * who play. The bear stands at the bottom of the frame, and the lit players fill it. The line
 * from the bear to the target turns at most 20° from the line to the back of the stage.
 *
 * @param subjects The subjects.
 * @param conductor The places of the conductor.
 * @param toward The middle of the players who play, or the podium with no such players.
 * @returns The subject.
 */
export function conductorBackSubject(
  subjects: StageSubjects,
  conductor: ConductorSubjects,
  toward: Vec3,
): Subject {
  const head = conductor.sights.head;
  const dx = toward[0] - head[0];
  const dz = toward[2] - head[2];
  // The bear faces -z, to the orchestra: the azimuth π. A point near the bear gives that line.
  const line = Math.hypot(dx, dz) < 0.5 ? Math.PI : azimuthOf(dx, dz);
  const turn = SUBJECT_SIZES.conductorBackTurn;
  const azimuth = Math.PI + Math.min(turn, Math.max(-turn, angleDifference(line, Math.PI)));
  const reach = SUBJECT_SIZES.conductorBackReach * subjects.stageSide;
  const target: Vec3 = [
    head[0] + Math.sin(azimuth) * reach,
    subjects.podium[1] + SUBJECT_SIZES.conductorBackHeight,
    head[2] + Math.cos(azimuth) * reach,
  ];
  return {
    target,
    front: azimuth - Math.PI,
    facing: Math.PI,
    center: head,
    eyes: null,
    back: 0,
    seats: [],
    part: null,
    sights: { owner: CONDUCTOR_OWNER, head, parts: [] },
    lift: 0,
    spread: 1,
    // The players fill the frame behind the bear, so no head of the stage is a foreground head.
    members: subjects.heads.map((h) => h.owner),
    focus: target,
    outside: null,
    floor: [],
    faces: [],
    outline: [target],
    reach: SUBJECT_SIZES.conductorBackRadius * subjects.stageSide,
    tops: [],
    lows: [],
  };
}

/** A side of the stage: -1 for the left side, 1 for the right side, as the audience sees it. */
export type StageSide = -1 | 1;

/**
 * Gives the side of the stage of a seat: the side of its principal player, or `null` for a
 * player on the middle line or a seat with no players.
 *
 * @param subjects The subjects.
 * @param seat The seat.
 * @returns The side, or `null`.
 */
export function sideOf(subjects: StageSubjects, seat: number): StageSide | null {
  const x = subjects.seats[seat]?.players[0]?.position[0] ?? 0;
  if (Math.abs(x) < 0.25) {
    return null;
  }
  return x < 0 ? -1 : 1;
}

/**
 * Gives the subject of a side view (design 5.6, views 03 and 04 of `scene.png`): the players of
 * some seats on one side of the stage, from the front of that side and low. The target is the
 * middle of the players, 1.0 m high, and at least `0.15 × S` from the middle line on its side.
 * The sphere of `SUBJECT_SIZES.sideRadius` holds about the front half of the side, and the frame
 * cuts the rest. Only the players in the sphere are subject players, so a head of another player
 * or of the conductor in front of them counts in the foreground rule. The players of the seats in
 * the sphere give the eyes, the look, and the extent of the frame.
 *
 * @param subjects The subjects.
 * @param seats The seats of the side view. There is at least one with players.
 * @param side The side of the stage.
 * @returns The subject, or `null` with no players.
 */
export function sideSubject(
  subjects: StageSubjects,
  seats: readonly number[],
  side: StageSide,
): Subject | null {
  const players = seats.flatMap((s) => subjects.seats[s]?.players ?? []);
  if (players.length === 0) {
    return null;
  }
  let x = 0;
  let z = 0;
  for (const p of players) {
    x += p.position[0];
    z += p.position[2];
  }
  const S = subjects.stageSide;
  const sizes = SUBJECT_SIZES;
  const middle = x / players.length;
  const target: Vec3 = [
    side * Math.max(sizes.sideReach * S, side * middle),
    subjects.podium[1] + sizes.sideHeight,
    z / players.length,
  ];
  // The players in the sphere are the group of the shot. A head of another player in front of
  // them counts in the foreground rule, so the side reads as one clear group.
  const reach = sizes.sideRadius * S;
  const inSphere = (p: SubjectPlayer): boolean =>
    Math.hypot(p.position[0] - target[0], p.position[2] - target[2]) <= reach;
  const members: number[] = [];
  for (const seat of subjects.seats) {
    for (const p of seat?.players ?? []) {
      if (inSphere(p)) {
        members.push(p.sights.owner);
      }
    }
  }
  // The look and the eyes come from the players that the frame holds, so that their eyes stand
  // on the upper third line. With no player of the seats in the sphere, all players count.
  const framed = players.filter(inSphere);
  const group = framed.length > 0 ? framed : players;
  return {
    target,
    front: side * sizes.sideFront,
    facing: meanFront(group),
    center: middleOf(group),
    eyes: headsOf(group),
    back: backOf(subjects, target[2]),
    seats,
    part: null,
    sights: null,
    lift: 0,
    spread: 1,
    members,
    focus: target,
    outside: null,
    floor: [],
    // The frame holds the heads and the hands of the players in the sphere, and it cuts the rest.
    ...extentOf(framed, target),
    outline: [target],
    reach,
  };
}

/**
 * Gives the middle of the principal players of some seats, weighted by their activity.
 *
 * @param subjects The subjects.
 * @param activity The activity of each seat.
 * @returns The middle, or the podium with no activity.
 */
export function activeMiddle(subjects: StageSubjects, activity: ArrayLike<number>): Vec3 {
  let x = 0;
  let z = 0;
  let total = 0;
  for (const [seat, players] of subjects.seats.entries()) {
    const principal = players?.players[0];
    const weight = activity[seat] ?? 0;
    if (!principal || weight <= 0) {
      continue;
    }
    x += principal.position[0] * weight;
    z += principal.position[2] * weight;
    total += weight;
  }
  return total > 0 ? [x / total, subjects.podium[1], z / total] : subjects.podium;
}
